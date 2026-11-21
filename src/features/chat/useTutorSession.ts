/**
 * HOOMAAN AI Tutor Session Hook
 *
 * Clean-room hook managing chat state lifecycle, scene command execution,
 * study database persistence, and token cost attribution.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSceneCommands } from "@/features/viewer/useSceneCommands";
import { CURRENT_CROSSING } from "@/features/viewer/scanCrossing";
import { CURRENT_LEVEL } from "@/features/viewer/vertebralLevel";
import {
  askAgent,
  cancelRequest,
  engineStatus,
  newRequestId,
} from "@/lib/ipc";
import { AgentRequestSchema, PROTOCOL_VERSION } from "@/lib/schemas";
import {
  sameTurnScope,
  TurnRegistry,
  type SpendContext,
  type TurnContext,
  type TurnScope,
} from "./turnRegistry";
import type {
  AiProvider,
  Language,
  ModelInfo,
  SceneCommand,
  TokenUsage,
  UserProfile,
} from "@/lib/schemas";
import { useCaseStore, virtualPatientContext } from "@/stores/caseStore";
import { completeHistory, useChatStore } from "@/stores/chatStore";
import { chatPreferences, patchChatPreferences } from "@/stores/chatPreferences";
import { useModelStore } from "@/stores/modelStore";
import { useBreathStore } from "@/stores/breathStore";
import { useHeartStore } from "@/stores/heartStore";
import { useScanStore } from "@/stores/scanStore";
import { groupNames, organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { useUsageStore } from "@/stores/usageStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { isCustomApiConfigured, useCustomApiConfig } from "@/stores/customApiConfig";
import { buildCustomSystemPrompt, streamCustomChat } from "./customApiClient";
import { breathAim } from "./breathContext";
import { heartAim } from "./heartContext";
import { scannerAim } from "./scannerContext";
import { useAimHint } from "./aimHint";

function currentTurnScope(): TurnScope {
  const chatState = useChatStore.getState();
  return {
    sessionId: chatState.sessionId,
    sessionRevision: chatState.sessionRevision,
    mode: chatState.mode,
    genderModel: useSceneStore.getState().genderModel,
    caseId: useCaseStore.getState().activeCaseId,
  };
}

export function useTutorSession() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const loadedOrgans = useSceneStore((state) => state.organs);
  const selectedOrganIds = useSceneStore((state) => state.selectedOrganIds);
  const isolatedOrganIds = useSceneStore((state) => state.isolatedOrganIds);
  const hiddenSystems = useSceneStore((state) => state.hiddenSystems);
  const genderModel = useSceneStore((state) => state.genderModel);
  const executeSceneCommand = useSceneStore((state) => state.applyCommand);

  const customBaseUrl = useCustomApiConfig((state) => state.baseUrl);
  const customApiKey = useCustomApiConfig((state) => state.apiKey);
  const customModel = useCustomApiConfig((state) => state.model);
  const customReady = isCustomApiConfigured({ baseUrl: customBaseUrl, model: customModel });
  const customAbortRef = useRef<AbortController | null>(null);

  const scanEnabled = useScanStore((state) => state.enabled);
  const scanPinned = useScanStore((state) => state.pinned);
  const scanPlane = useScanStore((state) => state.plane);

  const heartEnabled = useHeartStore((state) => state.enabled);
  const heartRhythm = useHeartStore((state) => state.rhythm);
  const heartSound = useHeartStore((state) => state.sound);

  const breathEnabled = useBreathStore((state) => state.enabled);
  const breathPattern = useBreathStore((state) => state.pattern);
  const { learned: aimHintLearned, retire: retireAimHint } = useAimHint();

  const chatMessages = useChatStore((state) => state.messages);
  const pendingRequestId = useChatStore((state) => state.pendingRequestId);
  const mode = useChatStore((state) => state.mode);
  const startTurn = useChatStore((state) => state.startTurn);
  const appendDelta = useChatStore((state) => state.appendDelta);
  const noteTool = useChatStore((state) => state.noteTool);
  const noteCommand = useChatStore((state) => state.noteCommand);
  const noteScore = useChatStore((state) => state.noteScore);
  const finishTurn = useChatStore((state) => state.finishTurn);
  const failTurn = useChatStore((state) => state.failTurn);
  const beginSession = useChatStore((state) => state.beginSession);

  const receiveModels = useModelStore((state) => state.receiveModels);
  const failCheck = useModelStore((state) => state.failCheck);

  const initialPreferences = chatPreferences();
  const [provider, setProvider] = useState<AiProvider>(initialPreferences.provider);
  const [profile, setProfile] = useState<UserProfile>(initialPreferences.profile);
  const [language, setLanguage] = useState<Language>(initialPreferences.language);
  const [spokenLimit, setSpokenLimit] = useState(initialPreferences.spokenLimit);
  const [spokenSpeed, setSpokenSpeed] = useState(initialPreferences.spokenSpeed);
  const [spokenVolume, setSpokenVolume] = useState(initialPreferences.spokenVolume);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const [engineReady, setEngineReady] = useState(false);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [preparing, setPreparing] = useState(false);

  const preparingRef = useRef(false);
  const verdictRef = useRef<Map<string, { score: number; verdict: string }>>(new Map());

  const turns = useMemo(
    () =>
      new TurnRegistry(currentTurnScope, (reqId) => {
        void cancelRequest(reqId);
        failTurn(reqId, "Turn canceled.");
      }),
    [failTurn],
  );

  useEffect(() => {
    const unsubscribers = [
      useChatStore.subscribe(turns.checkScope),
      useSceneStore.subscribe(turns.checkScope),
      useCaseStore.subscribe(turns.checkScope),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      turns.invalidate();
    };
  }, [turns]);

  const persistTurn = useCallback((requestId: string, turnContext: Readonly<TurnContext>) => {
    const chatState = useChatStore.getState();
    const recordedTurn = chatState.turn(requestId);
    const associatedOrgans = [...turnContext.organIds];
    const registeredGrade = verdictRef.current.get(requestId);
    verdictRef.current.delete(requestId);

    if (!recordedTurn) return;
    if (turnContext.mode === "review") return;

    const studyState = useStudyStore.getState();
    const { profile: targetProfile, language: targetLanguage } = turnContext;

    void studyState
      .saveTurn({
        session_id: turnContext.sessionId,
        kind: turnContext.mode,
        title: turnContext.title,
        profile: targetProfile,
        language: targetLanguage,
        question: recordedTurn.question,
        answer: recordedTurn.answer,
        organ_ids: associatedOrgans,
        model: recordedTurn.model ?? null,
        input_tokens: recordedTurn.usage?.input_tokens ?? null,
        output_tokens: recordedTurn.usage?.output_tokens ?? null,
        cache_read_tokens: recordedTurn.usage?.cache_read_tokens ?? null,
        commands: recordedTurn.commands ?? null,
        case_id: turnContext.mode === "case" ? turnContext.caseId : null,
      })
      .then((hasSaved) => {
        if (!hasSaved) return;
        if (registeredGrade) {
          void studyState.recordVerdict(turnContext.sessionId, registeredGrade.score, registeredGrade.verdict);
        }
        if (turnContext.mode === "case" && turnContext.caseId) {
          void useCaseStore.getState().refresh();
        }
      });
  }, []);

  const recordSpend = useCallback(
    (spendContext: Readonly<SpendContext>, usage: TokenUsage | null, modelName: string | null) => {
      if (!usage || !modelName) return;
      const { provider: activeProvider } = spendContext;

      void useUsageStore.getState().record({
        session_id: spendContext.sessionId,
        provider: activeProvider,
        model: modelName,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_tokens,
      });
    },
    [],
  );

  const acceptEngine = useCallback((protocolVersion: number) => {
    if (protocolVersion === PROTOCOL_VERSION) {
      setEngineReady(true);
      return;
    }
    setEngineReady(false);
    setTransportError(
      `This build of HOOMAAN speaks protocol ${PROTOCOL_VERSION}, but the ` +
        `engine bundled with it speaks ${protocolVersion}. That is a broken ` +
        `installation rather than anything you did — reinstall from a single ` +
        `release, and if it persists please report it.`,
    );
  }, []);

  useSceneCommands({
    acceptSceneCommand: (id) => turns.accepts(id),
    onReady: acceptEngine,
    onAttached: useCallback(() => {
      void engineStatus().then(
        (status) => {
          if (status.ready && status.protocol_version !== null) {
            acceptEngine(status.protocol_version);
          } else if (status.ready) {
            setEngineReady(true);
          } else if (status.error) {
            setTransportError(status.error);
          }
        },
        () => undefined,
      );
    }, [acceptEngine]),
    onTextDelta: useCallback(
      (requestId: string, deltaText: string) => {
        if (turns.accepts(requestId)) appendDelta(requestId, deltaText);
      },
      [appendDelta, turns],
    ),
    onToolStarted: useCallback(
      (requestId: string, toolName: string) => {
        if (turns.accepts(requestId)) noteTool(requestId, toolName);
      },
      [noteTool, turns],
    ),
    onSceneCommand: useCallback(
      (requestId: string, command: SceneCommand) => noteCommand(requestId, command),
      [noteCommand],
    ),
    onModels: useCallback(
      (requestId: string, modelProvider: AiProvider, modelsList: ModelInfo[]) =>
        receiveModels(modelProvider, requestId, modelsList),
      [receiveModels],
    ),
    onCaseVerdict: useCallback(
      (requestId: string, score: number, verdictText: string) => {
        if (!turns.accepts(requestId)) return;
        noteScore(requestId, score);
        verdictRef.current.set(requestId, { score, verdict: verdictText });
      },
      [noteScore, turns],
    ),
    onDone: useCallback(
      (requestId: string, tokenUsage: TokenUsage | null, modelName: string | null) => {
        const turnRecord = turns.take(requestId);
        if (!turnRecord) return;
        if (turnRecord.active) {
          finishTurn(requestId, tokenUsage ?? undefined, modelName ?? undefined);
          persistTurn(requestId, turnRecord.context);
        }
        verdictRef.current.delete(requestId);
        recordSpend(turnRecord.context, tokenUsage, modelName);
      },
      [finishTurn, persistTurn, recordSpend, turns],
    ),
    onProtocolViolation: useCallback(
      (_payload: unknown, violations: string) => {
        console.error("[engine] protocol violation", violations);
        const reqId =
          _payload && typeof _payload === "object" && "request_id" in _payload
            ? (_payload as { request_id: unknown }).request_id
            : null;
        if (typeof reqId === "string" && !turns.accepts(reqId)) {
          if (useModelStore.getState().providerFor(reqId)) {
            failCheck(reqId, "invalid_response", "The engine sent an unreadable model catalogue.");
          }
          return;
        }
        const violationMessage =
          "The engine sent an unreadable response. This turn was stopped. Retry, or restart the engine if the problem persists.";
        const currentPending = useChatStore.getState().pendingRequestId;
        if (currentPending) failTurn(currentPending, violationMessage);
        turns.invalidate();
        setTransportError(violationMessage);
      },
      [failTurn, failCheck, turns],
    ),
    onError: useCallback(
      (errCode: string, errMessage: string, requestId: string | null) => {
        if (requestId === null && errMessage.includes("stopped unexpectedly")) {
          setEngineReady(false);
        }
        if (requestId && useModelStore.getState().providerFor(requestId)) {
          failCheck(requestId, errCode, errMessage);
          return;
        }
        const targetTurnId = requestId ?? useChatStore.getState().pendingRequestId;
        if (requestId && !turns.accepts(requestId)) return;

        if (targetTurnId) {
          failTurn(targetTurnId, `${errCode}: ${errMessage}`);
          turns.invalidate(targetTurnId);
        } else {
          setTransportError(errMessage);
        }
      },
      [failTurn, failCheck, turns],
    ),
  });

  useEffect(() => {
    patchChatPreferences({ provider, profile, language, spokenLimit, spokenSpeed, spokenVolume });
  }, [provider, profile, language, spokenLimit, spokenSpeed, spokenVolume]);

  const visibleStructures = useMemo(
    () => Object.values(loadedOrgans).filter((organ) => !hiddenSystems.includes(organ.system)),
    [loadedOrgans, hiddenSystems],
  );
  const selectableGroups = useMemo(() => groupNames(visibleStructures), [visibleStructures]);
  const isHistoryCompacted = useMemo(() => completeHistory(chatMessages).length > 100, [chatMessages]);
  const chatReady = customReady || engineReady;
  const canSend = chatReady && draft.trim().length > 0 && !pendingRequestId && !preparing;

  const getScannerContext = useCallback(
    () =>
      scannerAim({
        enabled: scanEnabled,
        still: scanPinned || useScanStore.getState().held,
        plane: scanPlane,
        mode,
        selected: selectedOrganIds.length,
        level: CURRENT_LEVEL.value,
        organIds: CURRENT_CROSSING.value.organIds,
        total: CURRENT_CROSSING.value.total,
        organ: (id) => {
          const item = loadedOrgans[id];
          return item
            ? { organ_id: item.organ_id, ta2_latin: item.ta2_latin, name_en: item.name_en, system: item.system }
            : null;
        },
      }),
    [loadedOrgans, mode, scanEnabled, scanPinned, scanPlane, selectedOrganIds.length],
  );

  const activeHeartAim = useMemo(
    () => heartAim({ enabled: heartEnabled, mode, rhythm: heartRhythm, sound: heartSound }),
    [heartEnabled, heartRhythm, heartSound, mode],
  );

  const activeBreathAim = useMemo(
    () =>
      breathAim({
        enabled: breathEnabled,
        mode,
        pattern: breathPattern,
        heartEnabled,
        rhythm: heartRhythm,
      }),
    [breathEnabled, breathPattern, heartEnabled, heartRhythm, mode],
  );

  const handleSendQuery = useCallback(
    async (explicitText?: string) => {
      const rawQuery = (explicitText ?? draft).trim();
      if (!rawQuery || !chatReady || useChatStore.getState().pendingRequestId || preparingRef.current) return;

      const newTurnId = newRequestId();
      const chatStoreState = useChatStore.getState();
      const selectedOrgansList = selectedOrganIds
        .map((id) => loadedOrgans[id])
        .filter((organ): organ is NonNullable<typeof organ> => Boolean(organ))
        .map(({ organ_id, ta2_latin, name_en, system }) => ({ organ_id, ta2_latin, name_en, system }));

      const realtimeScannerState = getScannerContext();

      if (rawQuery.length > 8000 || selectedOrgansList.length > 64) {
        setTransportError(
          rawQuery.length > 8000
            ? "Use at most 8,000 characters per question. Your draft has been kept."
            : "Select at most 64 structures before asking. Your draft has been kept.",
        );
        return;
      }

      preparingRef.current = true;
      setPreparing(true);

      const turnContextData: TurnContext = {
        ...currentTurnScope(),
        provider,
        model: selectedModel,
        profile,
        language,
        organIds: selectedOrgansList.map((organ) => organ.organ_id),
        title: chatStoreState.messages.find((item) => item.role === "user")?.content ?? rawQuery,
      };

      turns.begin(newTurnId, turnContextData);
      let wasDispatched = false;

      try {
        const patientData =
          mode === "case" || mode === "review"
            ? await virtualPatientContext(
                turnContextData.sessionId,
                (id) => (loadedOrgans[id] ? organLabel(loadedOrgans[id]) : null),
                mode,
              )
            : {};

        if (!turns.accepts(newTurnId)) return;

        const outboundAgentRequest = AgentRequestSchema.parse({
          request_id: newTurnId,
          query: rawQuery,
          history: chatStoreState.history(),
          provider,
          ...(selectedModel ? { model: selectedModel } : {}),
          profile,
          language,
          gender_model: genderModel,
          mode,
          selection: selectedOrgansList,
          available_organs: visibleStructures.map(({ mesh_file: _mesh, node: _node, ...meta }) => meta),
          available_groups: selectableGroups,
          ...patientData,
          ...(realtimeScannerState ? { scanner: realtimeScannerState } : {}),
          ...(activeHeartAim ? { heart: activeHeartAim } : {}),
          ...(activeBreathAim ? { breathing: activeBreathAim } : {}),
        });

        if (!turns.markSent(newTurnId)) return;

        startTurn(newTurnId, rawQuery);
        setTransportError(null);
        wasDispatched = true;

        if (customReady) {
          const streamAbortController = new AbortController();
          customAbortRef.current = streamAbortController;

          const streamResult = await streamCustomChat({
            baseUrl: customBaseUrl,
            apiKey: customApiKey,
            model: customModel,
            systemPrompt: buildCustomSystemPrompt({
              fa: isPersian,
              profile,
              genderModel,
              mode,
              selection: selectedOrgansList,
              organCount: visibleStructures.length,
            }),
            history: chatStoreState.history(),
            query: rawQuery,
            mode,
            signal: streamAbortController.signal,
            onDelta: (chunk) => {
              if (turns.accepts(newTurnId)) appendDelta(newTurnId, chunk);
            },
            onToolStarted: (tool) => {
              if (turns.accepts(newTurnId)) noteTool(newTurnId, tool);
            },
            onSceneCommand: (cmd) => {
              if (turns.accepts(newTurnId)) {
                noteCommand(newTurnId, cmd);
                executeSceneCommand(cmd);
              }
            },
            onCaseVerdict: (scr, vrd) => {
              if (turns.accepts(newTurnId)) {
                noteScore(newTurnId, scr);
                verdictRef.current.set(newTurnId, { score: scr, verdict: vrd });
              }
            },
          });

          customAbortRef.current = null;
          const finalizedRecord = turns.take(newTurnId);
          if (finalizedRecord && finalizedRecord.active) {
            finishTurn(newTurnId, streamResult.usage ?? undefined, streamResult.model);
            persistTurn(newTurnId, finalizedRecord.context);
            recordSpend(finalizedRecord.context, streamResult.usage, streamResult.model);
          }
        } else {
          await askAgent(outboundAgentRequest);
        }

        if (explicitText === undefined && sameTurnScope(turnContextData, currentTurnScope())) {
          setDraft((prevDraft) => (prevDraft.trim() === rawQuery ? "" : prevDraft));
        }
        if (selectedOrgansList.length > 0) {
          retireAimHint();
        }
      } catch (sendError) {
        if (turns.accepts(newTurnId)) {
          if (wasDispatched) failTurn(newTurnId, String(sendError));
          setTransportError(
            isPersian
              ? `ارسال سؤال انجام نشد. پیش‌نویس شما ذخیره شد. ${String(sendError)}`
              : `Could not send the question. Your draft has been kept. ${String(sendError)}`,
          );
        }
        turns.invalidate(newTurnId);
      } finally {
        preparingRef.current = false;
        setPreparing(false);
      }
    },
    [
      draft,
      chatReady,
      selectedOrganIds,
      loadedOrgans,
      getScannerContext,
      provider,
      selectedModel,
      profile,
      language,
      turns,
      mode,
      genderModel,
      visibleStructures,
      selectableGroups,
      activeHeartAim,
      activeBreathAim,
      startTurn,
      customReady,
      retireAimHint,
      isPersian,
      customBaseUrl,
      customApiKey,
      customModel,
      appendDelta,
      noteTool,
      noteCommand,
      executeSceneCommand,
      noteScore,
      finishTurn,
      persistTurn,
      recordSpend,
      failTurn,
    ],
  );

  const handleStopTurn = useCallback(() => {
    customAbortRef.current?.abort();
    customAbortRef.current = null;
    turns.invalidate(useChatStore.getState().pendingRequestId);
  }, [turns]);

  const activeSystemsSet = useMemo(
    () => new Set(visibleStructures.map((organ) => organ.system)),
    [visibleStructures],
  );

  return {
    isPersian,
    chatReady,
    canSend,
    preparing,
    pendingRequestId,
    draft,
    setDraft,
    handleSendQuery,
    handleStopTurn,
    mode,
    beginSession,
    chatMessages,
    transportError,
    setTransportError,
    isHistoryCompacted,
    aimHintLearned,
    retireAimHint,
    selectedOrganIds,
    isolatedOrganIds,
    loadedOrgans,
    visibleStructures,
    activeSystemsSet,
    activeScannerAim: getScannerContext(),
    activeHeartAim,
    provider,
    setProvider,
    profile,
    setProfile,
    language,
    setLanguage,
    spokenLimit,
    setSpokenLimit,
    spokenSpeed,
    setSpokenSpeed,
    spokenVolume,
    setSpokenVolume,
    selectedModel,
    setSelectedModel,
    isSettingsOpen,
    setIsSettingsOpen,
  };
}

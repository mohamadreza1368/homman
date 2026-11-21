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
import { sameTurnScope, TurnRegistry, type SpendContext, type TurnContext, type TurnScope } from "./turnRegistry";
import type {
  AiProvider,
  Language,
  ModelInfo,
  SceneCommand,
  TokenUsage,
  UserProfile,
} from "@/lib/schemas";
import {
  useCaseStore,
  virtualPatientContext,
} from "@/stores/caseStore";
import { completeHistory, useChatStore } from "@/stores/chatStore";
import { chatPreferences, patchChatPreferences } from "@/stores/chatPreferences";
import { useModelStore } from "@/stores/modelStore";
import { useBreathStore } from "@/stores/breathStore";
import { useHeartStore } from "@/stores/heartStore";
import { useScanStore } from "@/stores/scanStore";
import { groupNames, organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { useUsageStore } from "@/stores/usageStore";

import { BrandLogo } from "@/components/BrandLogo";
import { shouldShowAimHint, useAimHint } from "./aimHint";
import { breathAim } from "./breathContext";
import { heartAim } from "./heartContext";
import { scannerAim } from "./scannerContext";
import { AimHint } from "./AskingGuide";
import { CaseBar } from "./CaseBar";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { isCustomApiConfigured, useCustomApiConfig } from "@/stores/customApiConfig";
import { buildCustomSystemPrompt, streamCustomChat } from "./customApiClient";

import { BridgeIndicator } from "./BridgeIndicator";
import { BridgeProse } from "./BridgeProse";
import { ChatComposer } from "./ChatComposer";
import { ChatEmptyState } from "./ChatEmptyState";
import { CostNotice, ModeSwitch, NewSessionButton } from "./ChatHeaderControls";
import { MessageBubble } from "./MessageBubble";
import { SettingsDrawer } from "./SettingsDrawer";

/**
 * Snapshots active session scope parameters for cancellation detection.
 */
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

/**
 * Primary dialogue container orchestrating tutoring, clinical case simulation,
 * live 3D anatomy commands, and speech synthesis.
 */
export function ChatPanel() {
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
  const startTurn = useChatStore((state) => state.startTurn);
  const noteCommand = useChatStore((state) => state.noteCommand);
  const appendDelta = useChatStore((state) => state.appendDelta);
  const noteTool = useChatStore((state) => state.noteTool);
  const finishTurn = useChatStore((state) => state.finishTurn);
  const failTurn = useChatStore((state) => state.failTurn);
  const noteScore = useChatStore((state) => state.noteScore);
  const mode = useChatStore((state) => state.mode);
  const beginSession = useChatStore((state) => state.beginSession);

  const [engineReady, setEngineReady] = useState(false);
  const [provider, setProvider] = useState<AiProvider>(() => chatPreferences().provider);
  const [profile, setProfile] = useState<UserProfile>(() => chatPreferences().profile);
  const [language, setLanguage] = useState<Language>(() => chatPreferences().language);
  const [spokenLimit, setSpokenLimit] = useState<number>(() => chatPreferences().spokenLimit);
  const [spokenSpeed, setSpokenSpeed] = useState<number>(() => chatPreferences().spokenSpeed);
  const [spokenVolume, setSpokenVolume] = useState<number>(() => chatPreferences().spokenVolume);
  const [draft, setDraft] = useState("");
  const [transportError, setTransportError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);

  const receiveModels = useModelStore((state) => state.receiveModels);
  const failCheck = useModelStore((state) => state.failCheck);
  const selectedModel = useModelStore((state) => state.byProvider[provider]?.selected ?? null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const verdictRef = useRef(new Map<string, { score: number; verdict: string }>());

  const [turns] = useState(
    () =>
      new TurnRegistry(currentTurnScope, (turnId, wasSent) => {
        useChatStore.getState().markCancelled(turnId);
        verdictRef.current.delete(turnId);
        customAbortRef.current?.abort();
        customAbortRef.current = null;
        if (wasSent) {
          void cancelRequest(turnId).catch((error: unknown) => {
            setTransportError(
              `The previous request was detached, but the engine could not confirm cancellation: ${String(error)}`,
            );
          });
        }
      }),
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

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    const remainingToBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    if (remainingToBottom < 120) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [chatMessages]);

  const visibleStructures = useMemo(
    () => Object.values(loadedOrgans).filter((organ) => !hiddenSystems.includes(organ.system)),
    [loadedOrgans, hiddenSystems],
  );
  const activeSystemsSet = useMemo(
    () => new Set(visibleStructures.map((organ) => organ.system)),
    [visibleStructures],
  );
  const selectableGroups = useMemo(() => groupNames(visibleStructures), [visibleStructures]);
  const isHistoryCompacted = useMemo(() => completeHistory(chatMessages).length > 100, [chatMessages]);
  const chatReady = customReady || engineReady;
  const canSend = chatReady && draft.trim().length > 0 && !pendingRequestId && !preparing;

  const getScannerContext = () =>
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
    });

  const activeScannerAim = getScannerContext();
  const activeHeartAim = heartAim({ enabled: heartEnabled, mode, rhythm: heartRhythm, sound: heartSound });
  const activeBreathAim = breathAim({
    enabled: breathEnabled,
    mode,
    pattern: breathPattern,
    heartEnabled,
    rhythm: heartRhythm,
  });

  async function handleSendQuery(explicitText?: string) {
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
  }

  function handleStopTurn() {
    customAbortRef.current?.abort();
    customAbortRef.current = null;
    turns.invalidate(useChatStore.getState().pendingRequestId);
  }

  return (
    <div dir={isPersian ? "rtl" : "ltr"} className="relative flex h-full min-h-0 flex-col bg-slate-900/95 backdrop-blur-2xl">
      <header className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <h1 className="flex items-center gap-1.5" aria-label="HOOMAAN">
          <BrandLogo variant="mark-dark" className="h-6 w-auto shrink-0" decorative />
          <BrandLogo variant="wordmark" className="h-4 w-auto shrink-0" alt="HOOMAAN — هومان" />
        </h1>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${
            chatReady
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {chatReady ? (isPersian ? "آماده" : "ready") : isPersian ? "نیازمند API" : "API needed"}
        </span>
        <BridgeIndicator />
        <div className="ms-auto flex items-center gap-1.5">
          <NewSessionButton
            mode={mode}
            onStart={beginSession}
            disabled={chatMessages.length === 0}
          />
          <ModeSwitch mode={mode} onChange={beginSession} />
        </div>
      </header>

      {(mode === "case" || mode === "review") && (
        <CaseBar profile={profile} language={language} />
      )}

      <SettingsDrawer
        provider={provider}
        onProviderChange={setProvider}
        profile={profile}
        onProfileChange={setProfile}
        language={language}
        onLanguageChange={setLanguage}
        spokenLimit={spokenLimit}
        onSpokenLimitChange={setSpokenLimit}
        spokenSpeed={spokenSpeed}
        onSpokenSpeedChange={setSpokenSpeed}
        spokenVolume={spokenVolume}
        onSpokenVolumeChange={setSpokenVolume}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {chatMessages.length === 0 && (
          <ChatEmptyState
            mode={mode}
            chatReady={chatReady}
            visibleStructuresCount={visibleStructures.length}
            activeSystemsSet={activeSystemsSet}
            onSendQuery={(query) => void handleSendQuery(query)}
          />
        )}

        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      <BridgeProse />

      {transportError && (
        <p className="mx-3 mb-2 rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-[11px] text-rose-300">
          {transportError}
        </p>
      )}

      {isHistoryCompacted && (
        <p role="status" className="mx-3 mb-2 text-[11px] text-slate-400">
          {isPersian
            ? "دستیار ۵۰ تبادل کامل اخیر را دریافت می‌کند. یادداشت‌ها و سوابق کامل شما نگهداری می‌شوند."
            : "The assistant receives the latest 50 complete exchanges. Your full journal is kept."}
        </p>
      )}

      <CostNotice messages={chatMessages} mode={mode} />

      {shouldShowAimHint({
        drafting: draft.trim().length > 0,
        hasAim: selectedOrganIds.length > 0 || isolatedOrganIds !== null || activeScannerAim !== null,
        mode,
        learned: aimHintLearned,
      }) && <AimHint onDismiss={retireAimHint} />}

      {activeScannerAim && draft.trim().length > 0 && (
        <p
          role="status"
          title={
            isPersian
              ? "یک ساختار را برای پرسش درباره آن انتخاب کنید: ساختار انتخابی بر اسکنر اولویت دارد."
              : "Select a structure to ask about it instead: a selection comes before the scanner."
          }
          className="mx-3 mb-2 text-[11px] text-cyan-400/80"
        >
          {isPersian
            ? `دستیار می‌داند اسکنر در ارتفاع ${activeScannerAim.level ?? "این سطح"} قرار دارد: «اینجا» و «این بخش» به این مقطع اشاره دارند.`
            : `The assistant knows the scanner is at ${activeScannerAim.level ?? "this height"}: “here” and “this part” mean this level.`}
        </p>
      )}

      {activeHeartAim && draft.trim().length > 0 && (
        <p role="status" className="mx-3 mb-2 text-[11px] text-rose-300/80">
          {isPersian
            ? `دستیار می‌داند ریتم قلب در حالت ${activeHeartAim.rhythm} است: بپرسید این چیست و چگونه رخ می‌دهد.`
            : `The assistant knows the heart is showing ${activeHeartAim.rhythm}: ask what it is and how it happens.`}
        </p>
      )}

      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSend={() => void handleSendQuery()}
        onStop={handleStopTurn}
        chatReady={chatReady}
        canSend={canSend}
        pendingRequestId={pendingRequestId}
        mode={mode}
      />
    </div>
  );
}

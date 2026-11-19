import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  conversationIsCostly,
  describeTurnCost,
  formatTokens,
  totalTokens,
} from "@/features/usage/tokens";
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
  AnatomicalSystem,
  Language,
  ModelInfo,
  SceneCommand,
  SessionMode,
  TokenUsage,
  UserProfile,
} from "@/lib/schemas";
import {
  activeCase,
  reviewReadiness,
  useCaseStore,
  virtualPatientContext,
} from "@/stores/caseStore";
import { completeHistory, useChatStore, type ChatMessage } from "@/stores/chatStore";
import { chatPreferences, patchChatPreferences } from "@/stores/chatPreferences";
import { useModelStore } from "@/stores/modelStore";
import { useBreathStore } from "@/stores/breathStore";
import { useHeartStore } from "@/stores/heartStore";
import { useScanStore } from "@/stores/scanStore";
import { groupNames, organLabel, useSceneStore } from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { useUsageStore } from "@/stores/usageStore";

import { BrandLogo } from "@/components/BrandLogo";
import { GrowingTextarea } from "@/components/GrowingTextarea";
import { shouldShowAimHint, useAimHint } from "./aimHint";
import { breathAim } from "./breathContext";
import { heartAim } from "./heartContext";
import { scannerAim } from "./scannerContext";
import { AimHint, AskingGuide } from "./AskingGuide";
import { CaseBar } from "./CaseBar";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { isCustomApiConfigured, useCustomApiConfig } from "@/stores/customApiConfig";
import { buildCustomSystemPrompt, streamCustomChat } from "./customApiClient";

import { Markdown } from "./Markdown";
import { collectOrganRefs, stripOrganRefs } from "./organRefs";
import { BridgeIndicator } from "./BridgeIndicator";
import { BridgeProse } from "./BridgeProse";
import { SettingsDrawer } from "./SettingsDrawer";
import { SpeakAnswerButton } from "./SpeakAnswerButton";
import { useCopy } from "./useCopy";

/** Advisory notice regarding AI-generated output validity. */
const AI_GENERATION_DISCLOSURE =
  "You are talking to an AI model. It can be wrong — check anything that matters.";

/** Descriptive labels for automated scene actions displayed in the tool run trace. */
const SCENE_TOOL_DESCRIPTIONS: Record<string, string> = {
  focus_organ: "focused a structure",
  scan_at_structure: "moved the scanner",
  set_heart_rhythm: "set the heart rhythm",
  isolate_structures: "isolated structures",
  isolate_group: "isolated a region",
  show_all_structures: "restored the full view",
  set_layer_visibility: "toggled a system",
  set_layer_opacity: "made a layer see-through",
  xray_system: "faded the other systems back",
  apply_pathology_overlay: "marked a pathology",
  clear_pathology_overlays: "cleared overlays",
  set_cross_section: "cut a section",
  record_case_verdict: "graded the answer",
};

/** Quick-start prompts for clinical case training, filtered by available anatomical systems. */
const CLINICAL_DRILL_PROMPTS: {
  label: string;
  labelFa: string;
  system: AnatomicalSystem;
  prompt: string;
  promptFa: string;
}[] = [
  {
    label: "Cardiac emergency",
    labelFa: "اورژانس قلبی",
    system: "cardiovascular",
    prompt: "Start a case drill: an acute cardiovascular emergency.",
    promptFa: "یک تمرین بالینی شروع کن: اورژانس حاد قلبی-عروقی.",
  },
  {
    label: "Respiratory",
    labelFa: "تنفسی",
    system: "respiratory",
    prompt: "Start a case drill: a patient in respiratory distress.",
    promptFa: "یک تمرین بالینی شروع کن: بیمار با دیسترس تنفسی.",
  },
  {
    label: "Neurological",
    labelFa: "عصبی",
    system: "nervous",
    prompt: "Start a case drill: an acute neurological deficit.",
    promptFa: "یک تمرین بالینی شروع کن: نقص عصبی حاد.",
  },
  {
    label: "Abdominal",
    labelFa: "شکمی",
    system: "digestive",
    prompt: "Start a case drill: acute abdominal pain.",
    promptFa: "یک تمرین بالینی شروع کن: درد حاد شکم.",
  },
];

/**
 * Notice detailing cumulative token consumption for long sessions.
 */
function CostNotice({ messages, mode }: { messages: ChatMessage[]; mode: SessionMode }) {
  const activePatient = useCaseStore(activeCase);
  const latestUsage = [...messages].reverse().find((item) => item.usage)?.usage;
  if (!conversationIsCostly(latestUsage)) return null;

  return (
    <p className="mx-3 mb-2 rounded border border-slate-700/70 bg-slate-800/40 px-2 py-1 text-[10px] leading-snug text-slate-400">
      Each question re-sends recent conversation context, so answers cost more the
      longer it runs — this one sent {formatTokens(totalTokens(latestUsage!))} tokens
      {latestUsage!.cache_read_tokens > 0 && (
        <>, {formatTokens(latestUsage!.cache_read_tokens)} of them re-read from the
        provider&rsquo;s cache at a reduced rate</>
      )}
      .{" "}
      {mode === "case" && activePatient
        ? "Starting a new visit keeps this patient's record and their marked complaints, and drops the transcript."
        : "Starting a new session drops the transcript."}
    </p>
  );
}

/**
 * Clipboard copy trigger with localized confirmation feedback.
 */
function CopyButton({ text, label }: { text: string; label?: string }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const { copied, copy } = useCopy();
  const idleCaption = label ?? (isPersian ? "کپی" : "Copy");

  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
    >
      {copied ? (isPersian ? "کپی شد" : "Copied") : idleCaption}
    </button>
  );
}

/**
 * Visual badge trail displaying executed scene operations with consecutive count aggregation.
 */
function ToolTrail({ tools }: { tools: string[] }) {
  if (tools.length === 0) return null;

  const aggregatedToolRuns: { toolName: string; occurrences: number }[] = [];
  for (const toolName of tools) {
    const previousRun = aggregatedToolRuns.at(-1);
    if (previousRun && previousRun.toolName === toolName) {
      previousRun.occurrences += 1;
    } else {
      aggregatedToolRuns.push({ toolName, occurrences: 1 });
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {aggregatedToolRuns.map((record, index) => (
        <span
          key={`${record.toolName}-${index}`}
          className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] text-slate-400"
        >
          {SCENE_TOOL_DESCRIPTIONS[record.toolName] ?? record.toolName}
          {record.occurrences > 1 && ` ×${record.occurrences}`}
        </span>
      ))}
    </div>
  );
}

/**
 * Restores 3D camera and system visibility state corresponding to an assistant answer.
 */
function RestoreViewButton({ commands }: { commands: SceneCommand[] }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const executeCommand = useSceneStore((state) => state.applyCommand);
  if (commands.length === 0) return null;

  const handleReplayScene = () => {
    for (const step of commands) {
      executeCommand(step);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReplayScene}
      title={isPersian ? "برگرداندن مدل به نمای زمان این پاسخ" : "Put the model back the way this answer left it"}
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-sky-600 hover:text-sky-200"
    >
      {isPersian ? "بازیابی این نما" : "Restore this view"}
    </button>
  );
}

/**
 * Renders interactive badges for referenced anatomical structures beneath assistant prose.
 */
function ReferenceLegend({ content }: { content: string }) {
  const loadedOrgans = useSceneStore((state) => state.organs);
  const highlightOrgan = useSceneStore((state) => state.setHovered);
  const targetOrganReference = useSceneStore((state) => state.focusReference);

  const matchedReferences = collectOrganRefs(content, (id) => id in loadedOrgans);
  if (matchedReferences.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-800/70 pt-2">
      {matchedReferences.map((refItem) => {
        const itemData = loadedOrgans[refItem.organId];
        if (!itemData) return null;
        return (
          <button
            key={refItem.organId}
            type="button"
            onMouseEnter={() => highlightOrgan(refItem.organId)}
            onMouseLeave={() => highlightOrgan(null)}
            onClick={() => targetOrganReference(refItem.organId, refItem.index)}
            className="flex items-center gap-1 rounded border border-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-sky-600 hover:text-sky-200"
          >
            <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-500/20 px-0.5 text-[8px] font-semibold text-sky-300">
              {refItem.index}
            </span>
            <span className="italic">{organLabel(itemData)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Displays graded score badge for clinical drill answers.
 */
function ScoreBadge({ score }: { score: number }) {
  const toneClasses =
    score >= 71
      ? "bg-emerald-500/15 text-emerald-300"
      : score >= 41
        ? "bg-amber-500/15 text-amber-300"
        : "bg-rose-500/15 text-rose-300";

  return (
    <span className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses}`}>
      {score}/100 · saved to your journal
    </span>
  );
}

/**
 * Saves assistant answer text to student study journal.
 */
function SaveAsNoteButton({ content }: { content: string }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const availableOrgans = useSceneStore((state) => state.organs);
  const activeOrganSelection = useSceneStore((state) => state.selectedOrganIds);
  const currentSessionId = useChatStore((state) => state.sessionId);
  const appendNoteToStudy = useStudyStore((state) => state.addNote);
  const [hasSaved, setHasSaved] = useState(false);

  const primarySelectedOrgan = activeOrganSelection[0] ? availableOrgans[activeOrganSelection[0]] : undefined;

  const handleStoreNote = () => {
    setHasSaved(true);
    void appendNoteToStudy({
      organ_id: primarySelectedOrgan?.organ_id ?? null,
      organ_label: primarySelectedOrgan ? organLabel(primarySelectedOrgan) : null,
      session_id: currentSessionId,
      body: stripOrganRefs(content),
    });
  };

  return (
    <button
      type="button"
      onClick={handleStoreNote}
      title={primarySelectedOrgan ? `Save as a note on ${organLabel(primarySelectedOrgan)}` : "Save as a note"}
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
    >
      {hasSaved ? (isPersian ? "ذخیره شد" : "Saved") : isPersian ? "ذخیره در یادداشت" : "Save as note"}
    </button>
  );
}

/**
 * Renders an individual message turn in the dialogue list.
 */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  if (message.role === "user") {
    return (
      <div className="group flex flex-col items-end gap-1">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-teal-500/30 bg-gradient-to-br from-teal-700/25 via-slate-800/40 to-sky-700/20 px-3.5 py-2.5 text-[13px] text-slate-100 shadow-md backdrop-blur-md">
          {message.content}
        </div>
        <div className="opacity-0 transition group-hover:opacity-100">
          <CopyButton text={message.content} />
        </div>
      </div>
    );
  }

  const isBlankContent = message.content.trim().length === 0;

  return (
    <div className="group flex flex-col gap-1">
      <div className="rounded-2xl rounded-bl-sm border border-slate-700/60 bg-slate-900/80 px-3.5 py-2.5 shadow-xl backdrop-blur-xl ring-1 ring-white/5">
        {message.score !== undefined && <ScoreBadge score={message.score} />}
        {isBlankContent && message.status === "streaming" ? (
          <span className="inline-flex gap-1 py-1" aria-label="Thinking">
            {[0, 1, 2].map((pulseIdx) => (
              <span
                key={pulseIdx}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500"
                style={{ animationDelay: `${pulseIdx * 160}ms` }}
              />
            ))}
          </span>
        ) : (
          <Markdown>{message.content}</Markdown>
        )}

        <ToolTrail tools={message.tools} />
        <ReferenceLegend content={message.content} />

        {message.status === "error" && (
          <p className="mt-2 rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-[11px] text-rose-300">
            {message.error}
          </p>
        )}
        {message.status === "cancelled" && (
          <p className="mt-2 text-[11px] italic text-slate-500">{isPersian ? "متوقف شد." : "Stopped."}</p>
        )}
      </div>

      {!isBlankContent && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
            <CopyButton text={stripOrganRefs(message.content)} label={isPersian ? "کپی پاسخ" : "Copy answer"} />
            <SaveAsNoteButton content={message.content} />
            {message.commands && <RestoreViewButton commands={message.commands} />}
            <SpeakAnswerButton content={message.content} language={chatPreferences().language} />
          </div>

          <span className="ml-auto flex items-baseline gap-1.5 text-[10px] text-slate-600">
            {message.model && (
              <span className="max-w-[11rem] truncate" title={`Answered by ${message.model}`}>
                {message.model}
              </span>
            )}
            {message.model && message.usage && <span className="text-slate-700">·</span>}
            {message.usage && (
              <span className="tabular-nums" title={describeTurnCost(message.usage).detail}>
                {describeTurnCost(message.usage).label}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Resets conversational exchange to start fresh.
 */
function NewSessionButton({
  mode,
  onStart,
  disabled,
}: {
  mode: SessionMode;
  onStart: (mode: SessionMode) => void;
  disabled: boolean;
}) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  return (
    <button
      type="button"
      onClick={() => onStart(mode)}
      disabled={disabled}
      title={
        disabled
          ? "This conversation is already empty"
          : "Start a fresh conversation — this one is kept in Study"
      }
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-sky-600 hover:text-sky-300 disabled:cursor-default disabled:border-slate-800 disabled:text-slate-700 disabled:hover:border-slate-800 disabled:hover:text-slate-700"
    >
      {isPersian ? "جدید" : "New"}
    </button>
  );
}

/**
 * Toggles between anatomy tutor and clinical case simulation modes.
 */
function ModeSwitch({
  mode,
  onChange,
}: {
  mode: SessionMode;
  onChange: (mode: SessionMode) => void;
}) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const availableModes: { value: SessionMode; label: string }[] = [
    { value: "tutor", label: isPersian ? "آموزش" : "Tutor" },
    { value: "case", label: isPersian ? "تمرین موردی" : "Case drill" },
  ];

  return (
    <div className="flex overflow-hidden rounded border border-slate-700">
      {availableModes.map((entry) => {
        const isSelected = entry.value === mode;
        return (
          <button
            key={entry.value}
            type="button"
            onClick={() => !isSelected && onChange(entry.value)}
            aria-pressed={isSelected}
            title={
              isSelected
                ? entry.label
                : `Switch to ${entry.label.toLowerCase()} — starts a new session`
            }
            className={`px-2 py-0.5 text-[10px] transition ${
              isSelected
                ? "bg-slate-700/70 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Overview of patient case findings and visits prior to review synthesis.
 */
function ReviewIntro({ onAsk, disabled }: { onAsk: () => void; disabled: boolean }) {
  const targetPatient = useCaseStore(activeCase);
  const caseSymptoms = useCaseStore((state) => state.symptoms);
  const pastVisits = useCaseStore((state) => state.visits);
  const patientRecord = useCaseStore((state) => state.record);

  if (!targetPatient) {
    return (
      <div className="space-y-2 pt-6 text-center text-xs text-slate-500">
        <p>No patient is open.</p>
        <p className="text-slate-600">
          A review is always about a case. Pick one above, or start a new
          conversation.
        </p>
      </div>
    );
  }

  const analysisProfile = reviewReadiness(targetPatient, caseSymptoms, pastVisits, patientRecord);
  const summaryInputs = [
    analysisProfile.complaints > 0 &&
      `${analysisProfile.complaints} ${analysisProfile.complaints === 1 ? "complaint" : "complaints"} marked on the body`,
    !analysisProfile.bare && "the findings on the record",
    analysisProfile.updates > 0 &&
      `${analysisProfile.updates} later ${analysisProfile.updates === 1 ? "entry" : "entries"}`,
    analysisProfile.visits > 0 && `${analysisProfile.visits} ${analysisProfile.visits === 1 ? "visit" : "visits"}`,
  ].filter((item): item is string => typeof item === "string");

  return (
    <div className="space-y-3 pt-6 text-center text-xs text-slate-500">
      <p>Reading the file back on {targetPatient.title}.</p>
      <p className="text-slate-600">
        What was presented, what has been reasoned, and where the gaps are.
        Nothing is written into the record.
      </p>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onAsk}
          className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200 disabled:opacity-30"
        >
          Summarise this case
        </button>
      </div>

      <div className="mx-auto max-w-[19rem] space-y-1.5 pt-1 text-left text-[10px] leading-snug text-slate-600">
        {summaryInputs.length > 0 && <p>It reads {summaryInputs.join(", ")}.</p>}

        {analysisProfile.visits === 0 && (
          <p className="text-amber-500/70">
            No visit has been recorded yet, so there is no reasoning to review —
            only what you have marked.
          </p>
        )}

        {analysisProfile.bare && (
          <p className="text-amber-500/70">
            This case carries no findings, so the summary has the complaints and
            the visits and nothing else to reason from. Add what is known from
            the patient record above — the sealed answer stays sealed either
            way.
          </p>
        )}

        {analysisProfile.ungraded > 0 && (
          <p>
            The sealed answer stays sealed: {analysisProfile.ungraded} of {analysisProfile.visits}{" "}
            {analysisProfile.visits === 1 ? "visit is" : "visits are"} ungraded, and so are
            their verdicts. Grade them and a review may use both.
          </p>
        )}

        {analysisProfile.visits > 0 && analysisProfile.ungraded === 0 && (
          <p>Every visit is graded, so the sealed answer is included.</p>
        )}

        <p className="text-slate-700">
          Past visits are read as their grades and verdicts, not as their
          transcripts. Reopen a visit from the record above to read what was
          said.
        </p>
      </div>
    </div>
  );
}

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
        {chatMessages.length === 0 && mode === "tutor" && (
          <div className="space-y-2 pt-6 text-center text-xs text-slate-500">
            <p>{isPersian ? "دربارهٔ هر ساختاری در نمای سه‌بعدی سؤال کنید." : "Ask about any structure in the viewport."}</p>
            {!chatReady && (
              <p className="text-[11px] text-amber-300/90">
                {isPersian
                  ? "برای شروع گفتگو، آدرس Custom API و نام مدل را در بخش تنظیمات بالا وارد کنید."
                  : "Enter your Custom API Base URL and model in Settings above to start chatting."}
              </p>
            )}
            <p className="text-slate-600">
              {isPersian ? "دستیار هنگام توضیح، دوربین را حرکت می‌دهد." : "The assistant moves the camera as it explains."}
            </p>
            <p className="text-[10px] text-slate-600">
              {isPersian ? "با یک مدل هوش مصنوعی گفتگو می‌کنید؛ پاسخ‌ها ممکن است اشتباه باشند." : AI_GENERATION_DISCLOSURE}
            </p>
            <p className="text-[10px] text-slate-700">
              {isPersian
                ? `${visibleStructures.length} ساختار بارگذاری شده؛ دستگاه‌های دیگر را از پنل اطلس فعال کنید.`
                : `${visibleStructures.length} structures loaded — switch on more systems in the left panel`}
            </p>
          </div>
        )}

        {chatMessages.length === 0 && mode === "case" && (
          <div className="space-y-3 pt-6 text-center text-xs text-slate-500">
            <p>{isPersian ? "یک سناریوی تمرینی انتخاب کنید یا خودتان بنویسید." : "Pick a scenario, or describe one yourself."}</p>
            <p className="text-slate-600">
              {isPersian
                ? "یک بیمار شبیه‌سازی‌شده و سؤال تمرینی دریافت می‌کنید و پاسخ شما برای مطالعهٔ شخصی نمره‌گذاری و ذخیره می‌شود."
                : "You will get an invented patient, the anatomy marked on the model, and a question to answer. Your answer gets a score for your own study — not a formal assessment — and is kept."}
            </p>
            <p className="text-[10px] text-slate-600">
              {isPersian ? "با یک مدل هوش مصنوعی گفتگو می‌کنید؛ پاسخ‌ها ممکن است خطا داشته باشند." : AI_GENERATION_DISCLOSURE}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {CLINICAL_DRILL_PROMPTS.filter((item) => activeSystemsSet.has(item.system)).map(
                (starter) => (
                  <button
                    key={starter.label}
                    type="button"
                    disabled={!chatReady}
                    onClick={() => void handleSendQuery(isPersian ? starter.promptFa : starter.prompt)}
                    className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-amber-600 hover:text-amber-200 disabled:opacity-30"
                  >
                    {isPersian ? starter.labelFa : starter.label}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={!chatReady}
                onClick={() =>
                  void handleSendQuery(
                    isPersian
                      ? "یک تمرین بالینی غیرمنتظره روی دستگاه‌های بارگذاری‌شده شروع کن."
                      : "Start a case drill on any system currently loaded. Pick something I am unlikely to have practised.",
                  )
                }
                className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-amber-600 hover:text-amber-200 disabled:opacity-30"
              >
                {isPersian ? "سناریوی تصادفی" : "Surprise me"}
              </button>
            </div>
            <p className="text-[10px] text-slate-700">
              {isPersian ? "بیماران شبیه‌سازی‌شده؛ صرفاً جهت تمرین آموزشی." : "Simulated patients, invented for practice."}
            </p>
          </div>
        )}

        {chatMessages.length === 0 && mode === "review" && (
          <ReviewIntro
            disabled={!chatReady}
            onAsk={() =>
              void handleSendQuery(
                "Summarise this case: what was presented, what has been reasoned " +
                  "across the visits, and where the gaps are.",
              )
            }
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

      <div className="shrink-0 border-t border-slate-800 p-3">
        <div className="relative">
          <GrowingTextarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleSendQuery();
              }
            }}
            rows={3}
            placeholder={
              !chatReady
                ? isPersian
                  ? "ابتدا آدرس و مدل Custom API را در تنظیمات وارد کنید…"
                  : "Configure Custom API Base URL and model first…"
                : mode === "review"
                  ? isPersian
                    ? "دربارهٔ پرونده سؤال کنید…"
                    : "Ask for the summary, or about anything in the file…"
                  : mode === "case"
                    ? isPersian
                      ? "به تمرین پاسخ دهید یا تمرین جدید بخواهید…"
                      : "Answer the case, or ask for a new one…"
                    : isPersian
                      ? "دربارهٔ آناتومی سؤال کنید…"
                      : "Ask about the anatomy…"
            }
            disabled={!chatReady}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-16 text-[13px] outline-none placeholder:text-slate-600 focus:border-sky-600 disabled:opacity-50"
          />
          {pendingRequestId ? (
            <button
              type="button"
              onClick={() => void handleStopTurn()}
              className="absolute bottom-2 right-2 rounded bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-100"
            >
              {isPersian ? "توقف" : "Stop"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSendQuery()}
              disabled={!canSend}
              className="absolute bottom-2 right-2 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-medium disabled:opacity-30"
            >
              {isPersian ? "ارسال" : "Send"}
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          <p className="flex-1 text-[10px] text-slate-600">
            {isPersian ? "فقط برای آموزش؛ برای تشخیص یا درمان نیست." : "Educational use only — not for diagnosis or treatment."}
          </p>
          <AskingGuide />
        </div>
      </div>
    </div>
  );
}

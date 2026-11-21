/**
 * HOOMAAN Dialogue & Clinical Reasoning Panel
 *
 * Clean-room component coordinating multi-modal anatomical tutoring,
 * virtual patient simulation, clinical safety triage, and scene control.
 */

import { useEffect, useRef } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { shouldShowAimHint } from "./aimHint";
import { AimHint } from "./AskingGuide";
import { CaseBar } from "./CaseBar";
import { BridgeIndicator } from "./BridgeIndicator";
import { BridgeProse } from "./BridgeProse";
import { ChatComposer } from "./ChatComposer";
import { ChatEmptyState } from "./ChatEmptyState";
import { CostNotice, ModeSwitch, NewSessionButton } from "./ChatHeaderControls";
import { MessageBubble } from "./MessageBubble";
import { SettingsDrawer } from "./SettingsDrawer";
import { useTutorSession } from "./useTutorSession";

export function ChatPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    isPersian,
    chatReady,
    canSend,
    pendingRequestId,
    draft,
    setDraft,
    handleSendQuery,
    handleStopTurn,
    mode,
    beginSession,
    chatMessages,
    transportError,
    isHistoryCompacted,
    aimHintLearned,
    retireAimHint,
    selectedOrganIds,
    isolatedOrganIds,
    visibleStructures,
    activeSystemsSet,
    activeScannerAim,
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
  } = useTutorSession();

  // Auto-scroll when near bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatMessages]);

  return (
    <div
      dir={isPersian ? "rtl" : "ltr"}
      className="relative flex h-full min-h-0 flex-col bg-slate-900/95 backdrop-blur-2xl"
    >
      {/* Header bar */}
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

      {/* Virtual patient case banner */}
      {(mode === "case" || mode === "review") && (
        <CaseBar profile={profile} language={language} />
      )}

      {/* Settings drawer */}
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

      {/* Message stream */}
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

      {/* Native control bridge messages */}
      <BridgeProse />

      {/* Transport diagnostics notice */}
      {transportError && (
        <p className="mx-3 mb-2 rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-[11px] text-rose-300">
          {transportError}
        </p>
      )}

      {/* History compaction badge */}
      {isHistoryCompacted && (
        <p role="status" className="mx-3 mb-2 text-[11px] text-slate-400">
          {isPersian
            ? "دستیار ۵۰ تبادل کامل اخیر را دریافت می‌کند. یادداشت‌ها و سوابق کامل شما نگهداری می‌شوند."
            : "The assistant receives the latest 50 complete exchanges. Your full journal is kept."}
        </p>
      )}

      {/* Token usage and cost metering */}
      <CostNotice messages={chatMessages} mode={mode} />

      {/* Interactive aim suggestions */}
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

      {/* Input composer dock */}
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

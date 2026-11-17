import { lazy, Suspense, useEffect, useState } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { ChatPanel } from "@/features/chat/ChatPanel";
import { GuideOverlay } from "@/features/help/GuideOverlay";
import { useFirstRun } from "@/features/help/useFirstRun";
import { IdleScreen } from "@/features/idle/IdleScreen";
import { useIdleScreen } from "@/features/idle/useIdleScreen";
import { LeftPanel } from "@/features/layout/LeftPanel";
import { SplashScreen } from "@/features/splash/SplashScreen";
import { useSplash } from "@/features/splash/useSplash";
import { ResizeHandle } from "@/features/layout/ResizeHandle";
import { CHAT_LIMITS, TREE_LIMITS, useLayout } from "@/features/layout/useLayout";
import { ConfirmDialog } from "@/features/common/ConfirmDialog";
import { PrintSheet } from "@/features/study/PrintSheet";
import { AnatomyViewer } from "@/features/viewer/AnatomyViewer";
import { useChatStore } from "@/stores/chatStore";
import { checkStorage, confirmStoragePersists } from "@/lib/localStore";
import { useStudyStore } from "@/stores/studyStore";
import { startViewPersistence } from "@/stores/persistView";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSessionAuth } from "@/stores/sessionAuth";

/**
 * Loaded only when opened: the Memory Lab brings its own renderer and brain, and
 * nobody who never opens it should pay for them at startup.
 */
const MemoryLab = lazy(() => import("@/features/memory/MemoryLab"));
import { useSceneStore } from "@/stores/sceneStore";

/**
 * The application shell: anatomy tree, viewport, assistant.
 *
 * Both side panels are resizable and collapsible, and their widths persist —
 * how much room the reading pane deserves versus the model depends on what
 * someone is doing, and that changes minute to minute.
 *
 * The viewport is a flex child rather than a fixed grid track so it absorbs
 * whatever the panels leave without overlapping or squeezing menus.
 */
export default function App() {
  const { layout, setTreeWidth, setChatWidth, toggleTree, toggleChat } = useLayout();
  const { firstRun, markSeen } = useFirstRun();
  const [guideOpen, setGuideOpen] = useState(firstRun);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const atlasReady = useSceneStore((s) => s.manifest !== null);
  const splash = useSplash(atlasReady);

  const authenticated = useSessionAuth((s) => s.authenticated);
  const userName = useSessionAuth((s) => s.userName);
  const signOut = useSessionAuth((s) => s.signOut);

  useEffect(startViewPersistence, []);
  useEffect(checkStorage, []);

  const journal = useStudyStore((s) => s.stats);
  useEffect(() => {
    if (!journal) return;
    confirmStoragePersists(journal.sessions + journal.notes + journal.cases > 0);
  }, [journal]);

  const answering = useChatStore((s) => s.pendingRequestId !== null);
  const idle = useIdleScreen({
    armed: atlasReady && !splash.visible && authenticated && !answering && !memoryOpen,
  });

  const closeGuide = () => {
    setGuideOpen(false);
    markSeen();
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950 text-slate-200">
      {splash.visible && <SplashScreen leaving={splash.leaving} />}
      {!splash.visible && !authenticated && <LoginScreen />}
      {idle.showing && <IdleScreen onDismiss={idle.dismiss} />}
      {memoryOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] bg-[#010408]" />}>
          <MemoryLab onClose={() => setMemoryOpen(false)} />
        </Suspense>
      )}
      <PrintSheet />
      <ConfirmDialog />

      {/* Left Anatomy / Study Panel */}
      <aside
        hidden={layout.treeCollapsed}
        inert={layout.treeCollapsed}
        className="relative z-10 flex min-h-0 shrink-0 flex-col overflow-hidden border-e border-slate-800/80 bg-slate-900/95 backdrop-blur-xl"
        style={{ width: layout.treeWidth }}
      >
        <LeftPanel />
      </aside>
      {!layout.treeCollapsed && (
        <ResizeHandle
          width={layout.treeWidth}
          onResize={setTreeWidth}
          side="left"
          min={TREE_LIMITS.min}
          max={TREE_LIMITS.max}
          defaultWidth={TREE_LIMITS.default}
          label="Resize the anatomy panel"
        />
      )}

      {/* Main 3D Viewport: expands cleanly into all available space */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#070d12]">
        <AnatomyViewer paused={memoryOpen} />
        <TopBar
          treeCollapsed={layout.treeCollapsed}
          chatCollapsed={layout.chatCollapsed}
          userName={userName}
          onToggleTree={toggleTree}
          onToggleChat={toggleChat}
          onOpenGuide={() => setGuideOpen(true)}
          onOpenMemory={() => setMemoryOpen(true)}
          onSignOut={signOut}
        />
        {guideOpen && authenticated && <GuideOverlay onClose={closeGuide} />}
      </main>

      {/* Right Assistant / Chat Panel */}
      {!layout.chatCollapsed && (
        <ResizeHandle
          width={layout.chatWidth}
          onResize={setChatWidth}
          side="right"
          min={CHAT_LIMITS.min}
          max={CHAT_LIMITS.max}
          defaultWidth={CHAT_LIMITS.default}
          label="Resize the assistant panel"
        />
      )}
      <aside
        hidden={layout.chatCollapsed}
        inert={layout.chatCollapsed}
        className="relative z-10 flex min-h-0 shrink-0 flex-col overflow-hidden border-s border-slate-800/80 bg-slate-900/95 backdrop-blur-xl"
        style={{ width: layout.chatWidth }}
      >
        <ChatPanel />
      </aside>
    </div>
  );
}

/**
 * TopBar: Sleek header bar anchored at top of the 3D viewport.
 */
function TopBar({
  treeCollapsed,
  chatCollapsed,
  userName,
  onToggleTree,
  onToggleChat,
  onOpenGuide,
  onOpenMemory,
  onSignOut,
}: {
  treeCollapsed: boolean;
  chatCollapsed: boolean;
  userName: string;
  onToggleTree: () => void;
  onToggleChat: () => void;
  onOpenGuide: () => void;
  onOpenMemory: () => void;
  onSignOut: () => void;
}) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between border-b border-teal-900/40 bg-[#091a20]/95 px-3 py-1.5 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-2">
        <PanelToggle
          active={!treeCollapsed}
          onClick={onToggleTree}
          title={
            treeCollapsed
              ? (fa ? "نمایش پنل آناتومی" : "Show the anatomy panel")
              : (fa ? "پنهان کردن پنل آناتومی" : "Hide the anatomy panel")
          }
        >
          ▌▍
        </PanelToggle>

        <div className="flex items-center gap-1.5">
          <BrandLogo variant="mark-dark" className="h-5 w-auto shrink-0" decorative />
          <span className="text-[11px] font-bold tracking-[0.18em] text-teal-300 hidden sm:inline" dir="ltr">HOOMAAN</span>
        </div>
      </div>

      <p className="mx-2 flex-1 truncate text-center text-[10.5px] text-slate-400">
        {fa ? "صرفاً برای آموزش؛ ابزار پزشکی یا وسیلهٔ تشخیص و درمان نیست." : "Educational use only — not a medical device, and not for diagnosis or treatment."}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenMemory}
          title={fa ? "دفترچهٔ یادداشت شما به صورت نقشهٔ حافظه" : "Your study journal, as a map of memories"}
          className="rounded-full border border-teal-700/60 bg-teal-950/40 px-2.5 py-0.5 text-[10px] leading-tight tracking-[0.15em] text-teal-300 transition hover:border-cyan-400 hover:text-cyan-200"
        >
          {fa ? "حافظه" : "MEMORY"}
        </button>

        <button
          type="button"
          onClick={onOpenGuide}
          title={fa ? "راهنمای کاربری هومان" : "How HOOMAAN works"}
          aria-label={fa ? "راهنمای کاربری هومان" : "How HOOMAAN works"}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 text-[11px] font-semibold text-slate-300 transition hover:border-sky-500 hover:text-sky-200"
        >
          ?
        </button>

        <button
          type="button"
          onClick={onSignOut}
          title={userName ? `${userName} — ${fa ? "خروج از حساب" : "Sign out"}` : fa ? "خروج" : "Sign out"}
          className="rounded-full border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[10px] leading-tight text-slate-400 transition hover:border-amber-500/60 hover:text-amber-300"
        >
          {fa ? "خروج" : "Sign out"}
        </button>

        <PanelToggle
          active={!chatCollapsed}
          onClick={onToggleChat}
          title={
            chatCollapsed
              ? (fa ? "نمایش دستیار" : "Show the assistant")
              : (fa ? "پنهان کردن دستیار" : "Hide the assistant")
          }
        >
          ▍▌
        </PanelToggle>
      </div>
    </header>
  );
}

function PanelToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded-lg px-2 py-1 text-[13px] leading-none transition ${
        active
          ? "bg-teal-500/15 text-teal-300 hover:bg-teal-500/25"
          : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

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
 * whatever the panels leave. Three sized columns would let a wide panel push
 * the canvas off-screen instead of shrinking it.
 */
export default function App() {
  const { layout, setTreeWidth, setChatWidth, toggleTree, toggleChat } = useLayout();
  const { firstRun, markSeen } = useFirstRun();
  // Opened for a first-time reader, because the two things they cannot discover
  // by poking at the model are the right-click menu and what the app is not for.
  const [guideOpen, setGuideOpen] = useState(firstRun);
  const [memoryOpen, setMemoryOpen] = useState(false);

  // Ready when the atlas is, not when React is: the panels render instantly
  // and would otherwise appear as empty furniture around a blank viewport.
  const atlasReady = useSceneStore((s) => s.manifest !== null);
  const splash = useSplash(atlasReady);

  const authenticated = useSessionAuth((s) => s.authenticated);
  const userName = useSessionAuth((s) => s.userName);
  const signOut = useSessionAuth((s) => s.signOut);

  // Remember how the reader left the view, so the next launch opens on it.
  useEffect(startViewPersistence, []);
  // Proved rather than assumed, once, at launch. An empty store and a refused
  // one both read as `null`, which is how a machine that could not save
  // anything went a whole release looking like a machine nobody had configured.
  useEffect(checkStorage, []);
  // And the harder half, once the journal has answered: whether anything
  // written by an earlier launch is still here. A browser engine that has
  // quietly fallen back to an in-memory store passes every check inside a
  // single run — this is the only one it fails.
  const journal = useStudyStore((s) => s.stats);
  useEffect(() => {
    if (!journal) return;
    confirmStoragePersists(journal.sessions + journal.notes + journal.cases > 0);
  }, [journal]);

  /**
   * The resting screen waits for the app to be genuinely idle.
   *
   * Not while an answer is still arriving, and — checked inside the hook —
   * not while a question sits typed and unsent. Someone who walks away
   * mid-answer comes back to the answer.
   */
  const answering = useChatStore((s) => s.pendingRequestId !== null);
  const idle = useIdleScreen({
    armed: atlasReady && !splash.visible && authenticated && !answering && !memoryOpen,
  });

  const closeGuide = () => {
    setGuideOpen(false);
    markSeen();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 text-slate-200">
      {splash.visible && <SplashScreen leaving={splash.leaving} />}
      {!splash.visible && !authenticated && <LoginScreen />}
      {idle.showing && <IdleScreen onDismiss={idle.dismiss} />}
      {memoryOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] bg-[#010408]" />}>
          <MemoryLab onClose={() => setMemoryOpen(false)} />
        </Suspense>
      )}
      {/* Renders through a portal into `<body>`, outside this tree: the print
          stylesheet hides `#root` so the sheet is the whole page. */}
      <PrintSheet />
      {/* Also a portal, and mounted after the sheet so it sits above it: the
          only thing allowed to interrupt a print preview is a question about
          destroying something. */}
      <ConfirmDialog />

      {/* Modern Studio HUD: Full-Bleed 3D Viewport canvas as the primary canvas */}
      <main className="absolute inset-0 z-0">
        <AnatomyViewer paused={memoryOpen} />
        {/* Scoped to the viewport rather than the window: the panels stay
            reachable, so the guide can be read next to the thing it describes. */}
        {guideOpen && authenticated && <GuideOverlay onClose={closeGuide} />}
      </main>

      {/* Floating Studio HUD Top Capsule */}
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

      {/* Floating Left Drawer: Anatomy Tree, Diseases, Study, Education, and View controls */}
      <>
        <aside
          hidden={layout.treeCollapsed}
          inert={layout.treeCollapsed}
          className="pointer-events-auto absolute top-14 bottom-3 left-3 z-20 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-[#09151c]/90 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10"
          style={{ width: layout.treeWidth }}
        >
          <LeftPanel />
        </aside>
        {!layout.treeCollapsed && (
          <div
            className="pointer-events-auto absolute top-14 bottom-3 z-20"
            style={{ left: `calc(12px + ${layout.treeWidth}px)` }}
          >
            <ResizeHandle
              width={layout.treeWidth}
              onResize={setTreeWidth}
              side="left"
              min={TREE_LIMITS.min}
              max={TREE_LIMITS.max}
              defaultWidth={TREE_LIMITS.default}
              label="Resize the anatomy panel"
            />
          </div>
        )}
      </>

      {/* Floating Right Drawer: Clinical Co-Pilot, Case Drills, Settings */}
      <>
        {!layout.chatCollapsed && (
          <div
            className="pointer-events-auto absolute top-14 bottom-3 z-20"
            style={{ right: `calc(12px + ${layout.chatWidth}px)` }}
          >
            <ResizeHandle
              width={layout.chatWidth}
              onResize={setChatWidth}
              side="right"
              min={CHAT_LIMITS.min}
              max={CHAT_LIMITS.max}
              defaultWidth={CHAT_LIMITS.default}
              label="Resize the assistant panel"
            />
          </div>
        )}
        <aside
          hidden={layout.chatCollapsed}
          inert={layout.chatCollapsed}
          className="pointer-events-auto absolute top-14 bottom-3 right-3 z-20 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-[#071318]/90 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10"
          style={{ width: layout.chatWidth }}
        >
          <ChatPanel />
        </aside>
      </>
    </div>
  );
}

/**
 * Panel toggles either side of the disclaimer.
 *
 * The disclaimer is permanent and non-dismissable — not a UI preference but
 * part of what keeps the product outside the scope of EU MDR 2017/745 (see
 * README). The toggles live here rather than inside the panels so a collapsed
 * panel can still be brought back.
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
  const fa = useInterfaceLanguage((s) => s.language === 'fa');
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
      <header className="pointer-events-auto flex max-w-[95vw] items-center gap-2 rounded-full border border-teal-500/30 bg-[#091a20]/90 px-3.5 py-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
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
          <span className="text-[11px] font-bold tracking-[0.2em] text-teal-300 hidden md:inline" dir="ltr">HOOMAAN</span>
        </div>

        <span aria-hidden className="mx-1 h-3.5 w-px bg-slate-700/60" />

        <p className="max-w-[420px] truncate text-center text-[10.5px] text-slate-300/80">
          {fa ? 'صرفاً برای آموزش؛ ابزار پزشکی یا تشخیص نیست.' : 'Educational use only — not a medical device, and not for diagnosis or treatment.'}
        </p>

        <span aria-hidden className="mx-1 h-3.5 w-px bg-slate-700/60" />

        <button
          type="button"
          onClick={onOpenMemory}
          title={fa ? "دفترچهٔ یادداشت شما به صورت نقشهٔ حافظه" : "Your study journal, as a map of memories"}
          className="rounded-full border border-teal-700/60 bg-teal-950/40 px-2.5 py-0.5 text-[10px] leading-[17px] tracking-[0.15em] text-teal-300 transition hover:border-cyan-400 hover:text-cyan-200"
        >
          {fa ? 'حافظه' : 'MEMORY'}
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
          title={userName ? `${userName} — ${fa ? 'خروج از حساب' : 'Sign out'}` : fa ? 'خروج' : 'Sign out'}
          className="rounded-full border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[10px] leading-[17px] text-slate-400 transition hover:border-amber-500/60 hover:text-amber-300"
        >
          {fa ? 'خروج' : 'Sign out'}
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
      </header>
    </div>
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
      className={`rounded px-1.5 py-0.5 text-[13px] leading-none transition ${
        active
          ? "text-slate-300 hover:text-sky-300"
          : "text-slate-600 hover:text-slate-400"
      }`}
    >
      {children}
    </button>
  );
}

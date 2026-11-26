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
import { MicroAnatomy3DModal } from "@/features/anatomy/MicroAnatomy3DModal";
import { useNavigationStore } from "@/stores/navigationStore";
import { useChatStore } from "@/stores/chatStore";
import { checkStorage, confirmStoragePersists } from "@/lib/localStore";
import { useStudyStore } from "@/stores/studyStore";
import { startViewPersistence } from "@/stores/persistView";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSessionAuth } from "@/stores/sessionAuth";
import { useSceneStore } from "@/stores/sceneStore";

const LazyMemoryLab = lazy(() => import("@/features/memory/MemoryLab"));

/**
 * Root application workspace shell unifying 3D anatomy viewer, clinical assistant,
 * taxonomy tree, and contextual overlays.
 */
export default function App() {
  const { layout, setTreeWidth, setChatWidth, toggleTree, toggleChat } = useLayout();
  const { firstRun, markSeen } = useFirstRun();
  const [isGuideOpen, setIsGuideOpen] = useState(firstRun);
  const [isMemoryLabOpen, setIsMemoryLabOpen] = useState(false);
  const microAnatomyScene = useNavigationStore((s) => s.microAnatomyScene);
  const setMicroAnatomyScene = useNavigationStore((s) => s.setMicroAnatomyScene);

  const isManifestLoaded = useSceneStore((s) => s.manifest !== null);
  const splashState = useSplash(isManifestLoaded);

  const isAuthenticated = useSessionAuth((s) => s.authenticated);
  const currentUserName = useSessionAuth((s) => s.userName);
  const triggerSignOut = useSessionAuth((s) => s.signOut);

  useEffect(startViewPersistence, []);
  useEffect(checkStorage, []);

  const journalStats = useStudyStore((s) => s.stats);
  useEffect(() => {
    if (!journalStats) return;
    confirmStoragePersists(journalStats.sessions + journalStats.notes + journalStats.cases > 0);
  }, [journalStats]);

  const isGeneratingResponse = useChatStore((s) => s.pendingRequestId !== null);
  const screensaver = useIdleScreen({
    armed:
      isManifestLoaded &&
      !splashState.visible &&
      isAuthenticated &&
      !isGeneratingResponse &&
      !isMemoryLabOpen,
  });

  const handleGuideClose = () => {
    setIsGuideOpen(false);
    markSeen();
  };

  return (
    <div dir="ltr" className="flex h-full w-full overflow-hidden bg-slate-950 text-slate-200">
      {splashState.visible && <SplashScreen leaving={splashState.leaving} />}
      {!splashState.visible && !isAuthenticated && <LoginScreen />}
      {screensaver.showing && <IdleScreen onDismiss={screensaver.dismiss} />}

      {isMemoryLabOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] bg-[#010408]" />}>
          <LazyMemoryLab onClose={() => setIsMemoryLabOpen(false)} />
        </Suspense>
      )}

      <PrintSheet />
      <ConfirmDialog />
      {microAnatomyScene && (
        <MicroAnatomy3DModal
          initialScene={microAnatomyScene}
          onClose={() => setMicroAnatomyScene(null)}
        />
      )}

      {/* Primary Anatomy Tree & Taxonomy Surface */}
      <aside
        hidden={layout.treeCollapsed}
        inert={layout.treeCollapsed}
        className="relative z-10 my-2 ms-2 flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/85 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5"
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

      {/* Center 3D Anatomical Viewport Canvas */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#070d12]">
        <AnatomyViewer paused={isMemoryLabOpen} />

        <TopNavigationHeader
          isTreeCollapsed={layout.treeCollapsed}
          isChatCollapsed={layout.chatCollapsed}
          userAccountLabel={currentUserName}
          onToggleTree={toggleTree}
          onToggleChat={toggleChat}
          onLaunchGuide={() => setIsGuideOpen(true)}
          onLaunchMemory={() => setIsMemoryLabOpen(true)}
          onSignOut={triggerSignOut}
        />

        {isGuideOpen && isAuthenticated && <GuideOverlay onClose={handleGuideClose} />}
      </main>

      {/* Right Assistant & Clinical Dialogue Surface */}
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
        className="relative z-10 my-2 me-2 flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/85 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5"
        style={{ width: layout.chatWidth }}
      >
        <ChatPanel />
      </aside>
    </div>
  );
}

interface TopNavigationHeaderProps {
  isTreeCollapsed: boolean;
  isChatCollapsed: boolean;
  userAccountLabel: string;
  onToggleTree: () => void;
  onToggleChat: () => void;
  onLaunchGuide: () => void;
  onLaunchMemory: () => void;
  onSignOut: () => void;
}

function TopNavigationHeader({
  isTreeCollapsed,
  isChatCollapsed,
  userAccountLabel,
  onToggleTree,
  onToggleChat,
  onLaunchGuide,
  onLaunchMemory,
  onSignOut,
}: TopNavigationHeaderProps) {
  const isPersianLocale = useInterfaceLanguage((s) => s.language === "fa");
  const updateLocale = useInterfaceLanguage((s) => s.setLanguage);

  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between border-b border-teal-500/20 bg-slate-950/80 px-4 py-2 shadow-xl backdrop-blur-2xl ring-1 ring-white/5">
      <div className="flex items-center gap-2">
        <SidebarToggleWidget
          active={!isTreeCollapsed}
          onClick={onToggleTree}
          title={
            isTreeCollapsed
              ? isPersianLocale
                ? "نمایش پنل آناتومی"
                : "Show the anatomy panel"
              : isPersianLocale
                ? "پنهان کردن پنل آناتومی"
                : "Hide the anatomy panel"
          }
        >
          ▌▍
        </SidebarToggleWidget>

        <div className="flex items-center gap-1.5">
          <BrandLogo variant="mark-dark" className="h-5 w-auto shrink-0" decorative />
          <span
            className="text-[11px] font-bold tracking-[0.18em] text-teal-300 hidden sm:inline"
            dir="ltr"
          >
            HOOMAAN
          </span>
        </div>
      </div>

      <p className="mx-2 flex-1 truncate text-center text-[10.5px] text-slate-400">
        {isPersianLocale
          ? "صرفاً برای آموزش؛ ابزار پزشکی یا وسیلهٔ تشخیص و درمان نیست."
          : "Educational use only — not a medical device, and not for diagnosis or treatment."}
      </p>

      <div className="flex items-center gap-1.5">
        <div
          className="flex items-center gap-0.5 rounded-full border border-slate-800 bg-slate-900/80 p-0.5 text-[10px]"
          aria-label={isPersianLocale ? "تغییر زبان" : "Change interface language"}
        >
          <button
            type="button"
            onClick={() => updateLocale("fa")}
            className={`rounded-full px-2 py-0.5 font-medium transition ${
              isPersianLocale
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            فارسی
          </button>
          <button
            type="button"
            onClick={() => updateLocale("en")}
            className={`rounded-full px-2 py-0.5 font-medium transition ${
              !isPersianLocale
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            EN
          </button>
        </div>

        <button
          type="button"
          onClick={onLaunchMemory}
          title={
            isPersianLocale
              ? "دفترچهٔ یادداشت شما به صورت نقشهٔ حافظه"
              : "Your study journal, as a map of memories"
          }
          className="rounded-full border border-teal-700/60 bg-teal-950/40 px-2.5 py-0.5 text-[10px] leading-tight tracking-[0.15em] text-teal-300 transition hover:border-cyan-400 hover:text-cyan-200"
        >
          {isPersianLocale ? "حافظه" : "MEMORY"}
        </button>

        <button
          type="button"
          onClick={onLaunchGuide}
          title={isPersianLocale ? "راهنمای کاربری هومان" : "How HOOMAAN works"}
          aria-label={isPersianLocale ? "راهنمای کاربری هومان" : "How HOOMAAN works"}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 text-[11px] font-semibold text-slate-300 transition hover:border-sky-500 hover:text-sky-200"
        >
          ?
        </button>

        <button
          type="button"
          onClick={onSignOut}
          title={
            userAccountLabel
              ? `${userAccountLabel} — ${isPersianLocale ? "خروج از حساب" : "Sign out"}`
              : isPersianLocale
                ? "خروج"
                : "Sign out"
          }
          className="rounded-full border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[10px] leading-tight text-slate-400 transition hover:border-amber-500/60 hover:text-amber-300"
        >
          {isPersianLocale ? "خروج" : "Sign out"}
        </button>

        <SidebarToggleWidget
          active={!isChatCollapsed}
          onClick={onToggleChat}
          title={
            isChatCollapsed
              ? isPersianLocale
                ? "نمایش دستیار"
                : "Show the assistant"
              : isPersianLocale
                ? "پنهان کردن دستیار"
                : "Hide the assistant"
          }
        >
          ▍▌
        </SidebarToggleWidget>
      </div>
    </header>
  );
}

function SidebarToggleWidget({
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

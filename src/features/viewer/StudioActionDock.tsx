import { useEffect, useState } from "react";
import {
  Activity,
  Compass,
  Eye,
  Heart,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scan,
  Sparkles,
  Wind,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { GLASS_OPACITY, useSceneStore } from "@/stores/sceneStore";
import { useHeartStore } from "@/stores/heartStore";
import { useBreathStore } from "@/stores/breathStore";
import { useScanStore } from "@/stores/scanStore";
import { useStudyViewsStore } from "@/stores/studyViewsStore";

import {
  DOLLY_IN,
  DOLLY_OUT,
  VIEW_HINT,
  VIEW_LABEL,
  VIEW_ORDER,
  zoomKeyFor,
  type AnatomicalView,
} from "./cameraViews";
import { viewportKey } from "./viewportKeys";

const VIEW_LABEL_FA: Record<AnatomicalView, string> = {
  anterior: "قدامی",
  posterior: "خلفی",
  left: "چپ",
  right: "راست",
  superior: "فوقانی",
};

const VIEW_HINT_FA: Record<AnatomicalView, string> = {
  anterior: "نمای قدامی (رو به رو) — کلید A",
  posterior: "نمای خلفی (پشت) — کلید P",
  left: "نمای پهلوی چپ — کلید L",
  right: "نمای پهلوی راست — کلید R",
  superior: "نمای فوقانی (از بالا) — کلید S",
};

type DockTab = "views" | "dissect" | "physio";

export function StudioActionDock() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const [activeTab, setActiveTab] = useState<DockTab>("views");
  const [minimized, setMinimized] = useState(false);

  // Scene actions
  const fitView = useSceneStore((s) => s.fitView);
  const orientView = useSceneStore((s) => s.orientView);
  const dollyView = useSceneStore((s) => s.dollyView);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const clearIsolation = useSceneStore((s) => s.clearIsolation);
  const glassBody = useSceneStore((s) => s.glassBody);
  const manifest = useSceneStore((s) => s.manifest);
  const systemOpacity = useSceneStore((s) => s.systemOpacity);
  const showAllSystems = useSceneStore((s) => s.showAllSystems);
  const resetView = useSceneStore((s) => s.resetView);
  const bodyTone = useSceneStore((s) => s.bodyTone);
  const cycleBodyTone = useSceneStore((s) => s.cycleBodyTone);
  const explode = useSceneStore((s) => s.explode);
  const cycleExplode = useSceneStore((s) => s.cycleExplode);

  // Simulation stores
  const heartEnabled = useHeartStore((s) => s.enabled);
  const toggleHeart = useHeartStore((s) => s.toggle);
  const breathEnabled = useBreathStore((s) => s.enabled);
  const toggleBreath = useBreathStore((s) => s.toggle);
  const scanEnabled = useScanStore((s) => s.enabled);
  const toggleScan = useScanStore((s) => s.toggle);

  // Study views
  const wantedStudyViews = useStudyViewsStore((s) => s.wanted);
  const setWantedStudyViews = useStudyViewsStore((s) => s.setWanted);

  const studying = isolatedOrganIds !== null && isolatedOrganIds.length > 0;
  const isGlass =
    (manifest?.systems.length ?? 0) > 0 &&
    (manifest?.systems ?? []).every(
      (entry) => systemOpacity[entry.system] === GLASS_OPACITY,
    );

  // Global key bindings for 3D navigation and camera
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = viewportKey(event);
      if (key === null) return;

      const direction = zoomKeyFor(event);
      if (direction !== null) {
        event.preventDefault();
        dollyView(direction === "in" ? DOLLY_IN : DOLLY_OUT);
        return;
      }

      if (key === "f") {
        event.preventDefault();
        fitView();
        return;
      }

      if (key === "x") {
        event.preventDefault();
        cycleExplode();
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dollyView, fitView, cycleExplode]);

  return (
    <nav
      aria-label={fa ? "داک ابزار استودیو هومان" : "HOOMAAN Studio Dock"}
      className="pointer-events-none absolute bottom-4 inset-x-0 z-30 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-slate-950/85 p-1.5 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 transition-all duration-300">
        {/* Tab switchers */}
        <div className="flex items-center gap-0.5 rounded-full bg-slate-900/80 p-0.5 border border-slate-800">
          <TabButton
            active={activeTab === "views" && !minimized}
            onClick={() => {
              setActiveTab("views");
              setMinimized(false);
            }}
            icon={<Compass className="h-3.5 w-3.5" />}
            label={fa ? "نماها" : "Views"}
          />
          <TabButton
            active={activeTab === "dissect" && !minimized}
            onClick={() => {
              setActiveTab("dissect");
              setMinimized(false);
            }}
            icon={<Layers className="h-3.5 w-3.5" />}
            label={fa ? "تشریح" : "Dissect"}
          />
          <TabButton
            active={activeTab === "physio" && !minimized}
            onClick={() => {
              setActiveTab("physio");
              setMinimized(false);
            }}
            icon={<Activity className="h-3.5 w-3.5" />}
            label={fa ? "فیزیولوژی" : "Physio"}
            badge={heartEnabled || breathEnabled || scanEnabled}
          />
        </div>

        <span aria-hidden className="h-4 w-px bg-slate-700/60" />

        {/* Content based on active tab */}
        {!minimized && (
          <div className="flex items-center gap-1">
            {activeTab === "views" && (
              <>
                <ActionButton
                  onClick={fitView}
                  title={
                    fa
                      ? studying
                        ? `تنظیم کادر روی ${isolatedOrganIds.length} ساختار — کلید F`
                        : "تنظیم کادر روی کل بدن — کلید F"
                      : studying
                        ? `Frame the ${isolatedOrganIds.length} structures — key F`
                        : "Frame the whole body — key F"
                  }
                  icon={<Maximize2 className="h-3.5 w-3.5 text-teal-300" />}
                >
                  {fa ? "کادر" : "Fit"}
                </ActionButton>

                <div className="flex items-center gap-0.5">
                  {VIEW_ORDER.map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => orientView(view)}
                      title={fa ? VIEW_HINT_FA[view] : `${VIEW_HINT[view]} — key ${VIEW_LABEL[view]}`}
                      className="h-6 rounded px-1.5 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-teal-300"
                    >
                      {fa ? VIEW_LABEL_FA[view] : VIEW_LABEL[view]}
                    </button>
                  ))}
                </div>

                <span aria-hidden className="h-3.5 w-px bg-slate-800" />

                <button
                  type="button"
                  onClick={() => dollyView(DOLLY_OUT)}
                  title={fa ? "دور شدن — کلید −" : "Zoom out — key −"}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => dollyView(DOLLY_IN)}
                  title={fa ? "نزدیک شدن — کلید +" : "Zoom in — key +"}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>

                {studying && (
                  <>
                    <span aria-hidden className="h-3.5 w-px bg-slate-800" />
                    <ActionButton
                      onClick={() => setWantedStudyViews(!wantedStudyViews)}
                      active={wantedStudyViews}
                      title={fa ? "تقسیم به ۴ نمای ارتوگرافیک همزمان" : "4-way Study Views"}
                      icon={<Eye className="h-3.5 w-3.5" />}
                    >
                      {fa ? "۴ نما" : "4-Views"}
                    </ActionButton>
                  </>
                )}
              </>
            )}

            {activeTab === "dissect" && (
              <>
                <ActionButton
                  onClick={glassBody}
                  active={isGlass}
                  title={fa ? "حالت کالبد شیشه‌ای شفاف برای دیدن اندام‌های عمقی" : "Glass body mode"}
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                >
                  {fa ? "شفاف" : "Glass"}
                </ActionButton>

                <ActionButton
                  onClick={cycleBodyTone}
                  title={fa ? "چرخش تنالیته رنگ بافت (طبیعی / کربنی / اسکن)" : "Cycle tissue tone"}
                >
                  {bodyTone === "carbon"
                    ? fa
                      ? "کربنی"
                      : "Carbon"
                    : bodyTone === "scan"
                      ? fa
                        ? "اسکن"
                        : "Scan"
                      : fa
                        ? "طبیعی"
                        : "Natural"}
                </ActionButton>

                <ActionButton
                  onClick={cycleExplode}
                  active={explode > 0}
                  title={fa ? `انفجار لایه‌ها (${Math.round(explode * 100)}%) — کلید X` : `Explode layers (${Math.round(explode * 100)}%) — key X`}
                >
                  {fa ? `انفجار ${explode > 0 ? `${Math.round(explode * 100)}%` : ""}` : `Explode ${explode > 0 ? `${Math.round(explode * 100)}%` : ""}`}
                </ActionButton>

                <ActionButton
                  onClick={showAllSystems}
                  title={fa ? "نمایش همه دستگاه‌های بدن" : "Show all anatomical systems"}
                >
                  {fa ? "همه" : "All"}
                </ActionButton>

                {studying && (
                  <ActionButton
                    onClick={clearIsolation}
                    title={fa ? "خروج از حالت ایزوله" : "Clear isolation"}
                  >
                    {fa ? "پایان ایزوله" : "Clear"}
                  </ActionButton>
                )}

                <button
                  type="button"
                  onClick={resetView}
                  title={fa ? "بازنشانی کامل نما و دوربین" : "Reset view"}
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {activeTab === "physio" && (
              <>
                <ActionButton
                  onClick={toggleHeart}
                  active={heartEnabled}
                  title={fa ? "شبیه‌ساز تپش مکانیکی قلب و نوار ECG" : "Cardiovascular cycle & ECG"}
                  icon={<Heart className={`h-3.5 w-3.5 ${heartEnabled ? "animate-pulse text-rose-400" : ""}`} />}
                >
                  {fa ? "تپش قلب" : "Heartbeat"}
                </ActionButton>

                <ActionButton
                  onClick={toggleBreath}
                  active={breathEnabled}
                  title={fa ? "شبیه‌ساز تنفس دیافراگم و قفسه سینه" : "Thoracic & diaphragmatic respiration"}
                  icon={<Wind className={`h-3.5 w-3.5 ${breathEnabled ? "text-cyan-400" : ""}`} />}
                >
                  {fa ? "تنفس" : "Breathing"}
                </ActionButton>

                <ActionButton
                  onClick={toggleScan}
                  active={scanEnabled}
                  title={fa ? "اسکنر توموگرافی و برش‌های مقطعی" : "Cross-section Tomography"}
                  icon={<Scan className={`h-3.5 w-3.5 ${scanEnabled ? "text-amber-400" : ""}`} />}
                >
                  {fa ? "اسکنر" : "Scanner"}
                </ActionButton>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setMinimized(!minimized)}
          title={minimized ? (fa ? "باز کردن داک ابزار" : "Expand dock") : (fa ? "جمع کردن داک" : "Minimize dock")}
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          {minimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
        </button>
      </div>
    </nav>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
        active
          ? "bg-teal-600/90 text-white shadow-sm ring-1 ring-teal-400/40"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-slate-900" />
      )}
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  title,
  icon,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  icon?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
        active
          ? "bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40 shadow-sm"
          : "text-slate-300 hover:bg-slate-800 hover:text-sky-300"
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

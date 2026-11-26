import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Compass,
  Eye,
  GitBranch,
  Heart,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scan,
  Scissors,
  Sparkles,
  Stethoscope,
  Sun,
  Wind,
  Zap,
  Radio,
  Crosshair,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { GLASS_OPACITY, useSceneStore } from "@/stores/sceneStore";
import { useHeartStore } from "@/stores/heartStore";
import { useBreathStore } from "@/stores/breathStore";
import { useScanStore } from "@/stores/scanStore";
import { useStudyViewsStore } from "@/stores/studyViewsStore";
import { usePhysiologyStore } from "@/stores/physiologyStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { diseasesForStructure } from "@/features/diseases/catalog";
import { getPedicleDefinition } from "./pedicleCatalog";

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

type DockTab = "views" | "dissect" | "physio" | "clinical" | "studio" | "diseases";

export function StudioActionDock() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const [activeTab, setActiveTab] = useState<DockTab>("views");
  const [minimized, setMinimized] = useState(false);

  // Scene actions
  const fitView = useSceneStore((s) => s.fitView);
  const orientView = useSceneStore((s) => s.orientView);
  const dollyView = useSceneStore((s) => s.dollyView);
  const genderModel = useSceneStore((s) => s.genderModel);
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const isolateSelection = useSceneStore((s) => s.isolateSelection);
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
  const halfDissection = useSceneStore((s) => s.halfDissection);
  const cycleHalfDissection = useSceneStore((s) => s.cycleHalfDissection);
  const dissectionDepth = useSceneStore((s) => s.dissectionDepth);
  const cycleDissectionDepth = useSceneStore((s) => s.cycleDissectionDepth);
  const isolatePedicle = useSceneStore((s) => s.isolatePedicle);
  const conductionVisible = useSceneStore((s) => s.conductionSystemVisible);
  const toggleConduction = useSceneStore((s) => s.toggleConductionSystem);
  const ecgLeadsVisible = useSceneStore((s) => s.ecgLeadsVisible);
  const toggleEcgLeads = useSceneStore((s) => s.toggleEcgLeads);
  const clinicalProceduresVisible = useSceneStore((s) => s.clinicalProceduresVisible);
  const toggleClinicalProcedures = useSceneStore((s) => s.toggleClinicalProcedures);
  const liverSegmentsMode = useSceneStore((s) => s.liverSegmentsMode);
  const toggleLiverSegmentsMode = useSceneStore((s) => s.toggleLiverSegmentsMode);
  const lightingPreset = useSceneStore((s) => s.lightingPreset ?? "studio");
  const setLightingPreset = useSceneStore((s) => s.setLightingPreset);
  const background = useSceneStore((s) => s.background);
  const setBackground = useSceneStore((s) => s.setBackground);

  // Simulation stores
  const heartEnabled = useHeartStore((s) => s.enabled);
  const toggleHeart = useHeartStore((s) => s.toggle);
  const breathEnabled = useBreathStore((s) => s.enabled);
  const toggleBreath = useBreathStore((s) => s.toggle);
  const scanEnabled = useScanStore((s) => s.enabled);
  const toggleScan = useScanStore((s) => s.toggle);
  const physioActive = usePhysiologyStore((s) => s.active);
  const setPhysioActive = usePhysiologyStore((s) => s.setActive);

  // Study views
  const wantedStudyViews = useStudyViewsStore((s) => s.wanted);
  const setWantedStudyViews = useStudyViewsStore((s) => s.setWanted);

  const studying = isolatedOrganIds !== null && isolatedOrganIds.length > 0;
  const isGlass =
    (manifest?.systems.length ?? 0) > 0 &&
    (manifest?.systems ?? []).every(
      (entry) => systemOpacity[entry.system] === GLASS_OPACITY,
    );

  const relatedDiseases = useMemo(() => {
    if (selectedOrganIds.length === 0) return [];
    return Array.from(
      new Set(
        selectedOrganIds.flatMap((id) =>
          diseasesForStructure(id, genderModel).map((d) => d.id),
        ),
      ),
    );
  }, [selectedOrganIds, genderModel]);

  const handleViewsClick = () => {
    setActiveTab("views");
    setMinimized(false);
    if (activeTab === "views") {
      fitView();
    }
  };

  const handleDissectClick = () => {
    setActiveTab("dissect");
    setMinimized(false);

    // If specific organs are currently selected, isolate them for focused dissection
    if ((selectedOrganIds?.length ?? 0) > 0 && !studying) {
      isolateSelection();
      return;
    }

    // Direct visual dissection feedback:
    if (!isGlass && explode === 0) {
      glassBody();
    } else if (isGlass && explode === 0) {
      cycleExplode();
    } else if (explode > 0) {
      cycleExplode();
    } else {
      glassBody();
    }
  };

  const handlePhysioClick = () => {
    setActiveTab("physio");
    setMinimized(false);

    if (!physioActive) {
      // Turn ON physiology mode: show heartbeat and breathing controls simultaneously
      setPhysioActive(true);
      if (!isGlass) {
        glassBody();
      }
      if (!heartEnabled) {
        toggleHeart();
      }
      if (!breathEnabled) {
        toggleBreath();
      }
    } else {
      // Turn OFF physiology mode: hide buttons and stop simulations
      setPhysioActive(false);
      if (heartEnabled) {
        toggleHeart();
      }
      if (breathEnabled) {
        toggleBreath();
      }
    }
  };

  const handleDiseasesClick = () => {
    setActiveTab("diseases");
    setMinimized(false);
    useNavigationStore.getState().openDiseasesForSelection();
  };

  const handleStudioClick = () => {
    setActiveTab("studio");
    setMinimized(false);
  };

  const handleClinicalClick = () => {
    setActiveTab("clinical");
    setMinimized(false);
  };

  useEffect(() => {
    if (selectedOrganIds.length === 0 && activeTab === "diseases") {
      setActiveTab("views");
    }
  }, [selectedOrganIds.length, activeTab]);

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
            onClick={handleViewsClick}
            icon={<Compass className="h-3.5 w-3.5" />}
            label={fa ? "نماها" : "Views"}
          />
          <TabButton
            active={activeTab === "dissect" && !minimized}
            onClick={handleDissectClick}
            icon={<Layers className="h-3.5 w-3.5" />}
            label={fa ? "تشریح" : "Dissect"}
            badge={isGlass || explode > 0 || studying || halfDissection !== "off" || dissectionDepth > 0 || clinicalProceduresVisible}
          />
          <TabButton
            active={activeTab === "physio" && !minimized}
            onClick={handlePhysioClick}
            icon={<Activity className={`h-3.5 w-3.5 ${heartEnabled ? "animate-pulse text-rose-400" : ""}`} />}
            label={fa ? "فیزیولوژی" : "Physio"}
            badge={physioActive || heartEnabled || breathEnabled || scanEnabled || conductionVisible || ecgLeadsVisible}
          />
          <TabButton
            active={activeTab === "clinical" && !minimized}
            onClick={handleClinicalClick}
            icon={<Crosshair className="h-3.5 w-3.5 text-emerald-400" />}
            label={fa ? "بالینی" : "Clinical"}
            badge={conductionVisible || ecgLeadsVisible || clinicalProceduresVisible}
          />
          <TabButton
            active={activeTab === "studio" && !minimized}
            onClick={handleStudioClick}
            icon={<Sun className="h-3.5 w-3.5" />}
            label={fa ? "استودیو" : "Studio"}
          />
          {selectedOrganIds.length > 0 && (
            <TabButton
              active={activeTab === "diseases" && !minimized}
              onClick={handleDiseasesClick}
              icon={<Stethoscope className="h-3.5 w-3.5 text-rose-400" />}
              label={fa ? "بیماری‌ها" : "Diseases"}
              badge={relatedDiseases.length > 0}
            />
          )}
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
                  onClick={cycleHalfDissection}
                  active={halfDissection !== "off"}
                  title={
                    fa
                      ? halfDissection === "off"
                        ? "نیمه‌تشریح سبک اطلس نتر (برداشتن عضلات یک سمت برای مشاهده همزمان عروق/اعصاب عمقی در برابر عضلات سطحی)"
                        : halfDissection === "right"
                          ? "نیمه‌تشریح: سمت راست عمقی (چپ سطحی)"
                          : "نیمه‌تشریح: سمت چپ عمقی (راست سطحی)"
                      : `Split dissection (currently: ${halfDissection})`
                  }
                  icon={<Scissors className="h-3.5 w-3.5" />}
                >
                  {halfDissection === "off"
                    ? fa
                      ? "نیمه‌تشریح"
                      : "Split"
                    : halfDissection === "right"
                      ? fa
                        ? "راست عمقی"
                        : "R. Deep"
                      : fa
                        ? "چپ عمقی"
                        : "L. Deep"}
                </ActionButton>

                <ActionButton
                  onClick={cycleDissectionDepth}
                  active={dissectionDepth > 0}
                  title={
                    fa
                      ? `لایه‌برداری عمقی (سطح ${dissectionDepth}): ${
                          dissectionDepth === 0
                            ? "کامل (سطحی)"
                            : dissectionDepth === 1
                              ? "فاشیا و لایه سطحی برداشته شده"
                              : dissectionDepth === 2
                                ? "لایه عضلانی برداشته شده، عروق/اعصاب و احشا نمایان"
                                : "چارچوب اسکلتی و احشای مرکزی"
                        }`
                      : `Dissection depth: level ${dissectionDepth}`
                  }
                  icon={<Layers className="h-3.5 w-3.5" />}
                >
                  {dissectionDepth === 0
                    ? fa
                      ? "عمق لایه‌ها"
                      : "Depth"
                    : fa
                      ? `عمق ${dissectionDepth}`
                      : `Depth ${dissectionDepth}`}
                </ActionButton>

                {selectedOrganIds.length === 1 && selectedOrganIds[0] && getPedicleDefinition(selectedOrganIds[0]) && (
                  <ActionButton
                    onClick={() => isolatePedicle(selectedOrganIds[0]!)}
                    title={
                      fa
                        ? "ایزوله‌سازی پدیکل عروقی-عصبی (شریان، ورید، مجاری و اعصاب تغذیه‌کننده)"
                        : "Isolate surgical neurovascular pedicle"
                    }
                    icon={<GitBranch className="h-3.5 w-3.5 text-amber-300" />}
                  >
                    {fa ? "پدیکل" : "Pedicle"}
                  </ActionButton>
                )}

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
                  onClick={toggleClinicalProcedures}
                  active={clinicalProceduresVisible}
                  title={
                    fa
                      ? "راهنمای سه‌بعدی اقدامات بالینی اورژانس (LP، چست تیوب، خط مرکزی IJV، کریکوتیروئیدوتومی)"
                      : "Emergency Clinical Procedures 3D HUD (LP, Chest tube, CVC, Cricothyroidotomy)"
                  }
                  icon={<Crosshair className={`h-3.5 w-3.5 ${clinicalProceduresVisible ? "text-rose-400" : ""}`} />}
                >
                  {fa ? "اورژانس" : "Procedures"}
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
                  onClick={() => {
                    if (!heartEnabled && !isGlass) {
                      glassBody();
                    }
                    toggleHeart();
                  }}
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

                <ActionButton
                  onClick={toggleConduction}
                  active={conductionVisible}
                  title={
                    fa
                      ? "سیستم هدایت الکتریکی قلب (گره SA، گره AV، دسته هیس، پورکینژ)"
                      : "Cardiac Conduction System (SA, AV, His, Purkinje network)"
                  }
                  icon={<Zap className={`h-3.5 w-3.5 ${conductionVisible ? "text-amber-400" : ""}`} />}
                >
                  {fa ? "هدایت قلب" : "Conduction"}
                </ActionButton>

                <ActionButton
                  onClick={toggleEcgLeads}
                  active={ecgLeadsVisible}
                  title={
                    fa
                      ? "محل الکترودهای سینه‌ای لیدهای ۱۲گانه V1 تا V6 بر اساس نشانه‌های دنده‌ای"
                      : "12-Lead Precordial Electrodes V1-V6 anatomical landmarks"
                  }
                  icon={<Radio className={`h-3.5 w-3.5 ${ecgLeadsVisible ? "text-emerald-400" : ""}`} />}
                >
                  {fa ? "لید V1-V6" : "12-Lead"}
                </ActionButton>
              </>
            )}

            {activeTab === "clinical" && (
              <>
                <ActionButton
                  onClick={() => useNavigationStore.getState().openSurgicalAtlas()}
                  title={
                    fa
                      ? "باز کردن اطلس فضاها و مثلث‌های جراحی (کالوت، اسکارپا، هسلباخ، کاروتید...)"
                      : "Open Surgical Triangles & Spaces Atlas (Gray's Surgical Anatomy)"
                  }
                  icon={<Scissors className="h-3.5 w-3.5 text-emerald-400" />}
                >
                  {fa ? "مثلث‌های جراحی" : "Surgical Atlas"}
                </ActionButton>

                <ActionButton
                  onClick={toggleClinicalProcedures}
                  active={clinicalProceduresVisible}
                  title={
                    fa
                      ? "راهنمای سه‌بعدی اقدامات بالینی اورژانس (LP، چست تیوب، خط مرکزی، کریکو، سمع قلب)"
                      : "Emergency Clinical Procedures 3D HUD (LP, Chest tube, CVC, Cricothyroidotomy)"
                  }
                  icon={<Crosshair className={`h-3.5 w-3.5 ${clinicalProceduresVisible ? "text-rose-400" : ""}`} />}
                >
                  {fa ? "اقدامات اورژانس" : "Procedures"}
                </ActionButton>

                <ActionButton
                  onClick={toggleConduction}
                  active={conductionVisible}
                  title={
                    fa
                      ? "سیستم هدایت الکتریکی قلب (گره SA، گره AV، دسته هیس، پورکینژ)"
                      : "Cardiac Conduction System (SA, AV, His, Purkinje)"
                  }
                  icon={<Zap className={`h-3.5 w-3.5 ${conductionVisible ? "text-amber-400" : ""}`} />}
                >
                  {fa ? "هدایت قلب" : "Conduction"}
                </ActionButton>

                <ActionButton
                  onClick={toggleEcgLeads}
                  active={ecgLeadsVisible}
                  title={
                    fa
                      ? "محل الکترودهای سینه‌ای لیدهای ۱۲گانه V1 تا V6"
                      : "12-Lead Precordial Electrodes V1-V6"
                  }
                  icon={<Radio className={`h-3.5 w-3.5 ${ecgLeadsVisible ? "text-emerald-400" : ""}`} />}
                >
                  {fa ? "لید V1-V6" : "12-Lead"}
                </ActionButton>

                <ActionButton
                  onClick={toggleLiverSegmentsMode}
                  active={liverSegmentsMode}
                  title={
                    fa
                      ? "تغییر بین نمای یکپارچه کبد (بدون تداخل) و ۸ سگمان جراحی کوئینا"
                      : "Switch between unified Liver mesh and 8 Couinaud segments"
                  }
                >
                  {fa ? "سگمان کبد" : "Liver Segs"}
                </ActionButton>

                <ActionButton
                  onClick={() => useNavigationStore.getState().setMicroAnatomyScene("nephron")}
                  title={
                    fa
                      ? "باز کردن نمایشگر سه‌بعدی میکروآناتومی (نفرون کلیه، لوبول کبد، آلوئول ریه، دندان)"
                      : "Open 3D Micro-Anatomy Sub-Viewer (Nephron, Hepatic Lobule, Alveolus, Dental)"
                  }
                >
                  {fa ? "میکروآناتومی 3D" : "3D Micro"}
                </ActionButton>
              </>
            )}

            {activeTab === "studio" && (
              <>
                <ActionButton
                  onClick={() => setLightingPreset?.("studio")}
                  active={lightingPreset === "studio"}
                  title={fa ? "نورپردازی استودیویی طبیعی کالبدشناسی" : "Studio balanced lighting"}
                  icon={<Sun className="h-3.5 w-3.5 text-amber-300" />}
                >
                  {fa ? "طبیعی" : "Natural"}
                </ActionButton>

                <ActionButton
                  onClick={() => setLightingPreset?.("surgical")}
                  active={lightingPreset === "surgical"}
                  title={fa ? "نور متمرکز و درخشان اتاق عمل جراحی" : "Surgical theater bright lighting"}
                  icon={<Sparkles className="h-3.5 w-3.5 text-cyan-300" />}
                >
                  {fa ? "جراحی" : "Surgical"}
                </ActionButton>

                <ActionButton
                  onClick={() => setLightingPreset?.("radiology")}
                  active={lightingPreset === "radiology"}
                  title={fa ? "نور کنتراست بالا برای تفکیک اسکلت و برجستگی‌ها" : "High contrast & bone rim lighting"}
                >
                  {fa ? "کنتراست" : "Contrast"}
                </ActionButton>

                <span aria-hidden className="h-3.5 w-px bg-slate-800" />

                <ActionButton
                  onClick={() => setBackground?.(background === "dark" ? "light" : "dark")}
                  title={fa ? `تغییر پس‌زمینه (فعلی: ${background === "dark" ? "تیره" : "روشن"})` : `Toggle background (current: ${background})`}
                >
                  {background === "dark" ? (fa ? "تیره" : "Dark") : (fa ? "روشن" : "Light")}
                </ActionButton>
              </>
            )}

            {activeTab === "diseases" && (
              <div className="flex items-center gap-1.5 px-1">
                <button
                  type="button"
                  onClick={() => useNavigationStore.getState().openDiseasesForSelection()}
                  className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-medium text-rose-200 ring-1 ring-rose-400/40 hover:bg-rose-500/30 transition"
                >
                  <Stethoscope className="h-3 w-3" />
                  <span>{fa ? "مشاهده در پنل بیماری‌ها" : "View in Disease Panel"}</span>
                  {relatedDiseases.length > 0 && (
                    <span className="rounded-full bg-rose-500/40 px-1 text-[9px] text-white">
                      {relatedDiseases.length}
                    </span>
                  )}
                </button>

                {relatedDiseases.length > 0 ? (
                  <span className="text-[10px] text-slate-400">
                    {fa
                      ? `${relatedDiseases.length} مورد مرتبط`
                      : `${relatedDiseases.length} conditions`}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">
                    {fa ? "موردی برای این عضو ثبت نشده" : "No mapped conditions"}
                  </span>
                )}
              </div>
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

import { useMemo, useState } from "react";

import type { AnatomicalSystem, ManifestOrgan, SectionPlane } from "@/lib/schemas";

import { busiestTouches, coverageLegend } from "@/features/viewer/coverage";
import { exportViewImage } from "@/features/viewer/exportView";
import { explodeScope, MAX_EXPLODE } from "@/features/viewer/explode";
import { SYSTEM_COLOURS, SYSTEM_LABELS } from "@/features/viewer/palette";

import { StructureSearch } from "./StructureSearch";
import {
  isOrganVisible,
  organLabel,
  organSubtitle,
  useSceneStore,
} from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

const PERSIAN_SYSTEM_NAMES: Record<string, string> = {
  articular: "مفاصل",
  cardiovascular: "قلب و عروق",
  digestive: "گوارش",
  endocrine: "غدد",
  lymphatic: "لنفاوی",
  muscular: "عضلات",
  nervous: "عصبی",
  regional: "سطح بدن",
  renal: "ادراری",
  reproductive: "تولیدمثل",
  respiratory: "تنفسی",
  skeletal: "اسکلت",
  integumentary: "پوست",
  visceral: "احشا",
};

const SECTION_PLANES_LIST: SectionPlane[] = ["axial", "coronal", "sagittal"];

/**
 * Checks whether an anatomical system folder is currently expanded in the tree view.
 */
export function systemIsOpen(
  expandedMap: Record<string, boolean>,
  systemName: string,
): boolean {
  return expandedMap[systemName] === true;
}

function ViewportCaptureButton() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const [isExporting, setIsExporting] = useState(false);
  const [exportOutcome, setExportOutcome] = useState<string | null>(null);

  const handleCapture = () => {
    setIsExporting(true);
    setExportOutcome(null);
    exportViewImage()
      .then((savedPath) => setExportOutcome(savedPath ? `Saved to ${savedPath}` : null))
      .catch((err: unknown) =>
        setExportOutcome(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setIsExporting(false));
  };

  return (
    <div className="pt-1">
      <button
        type="button"
        disabled={isExporting}
        onClick={handleCapture}
        title="Save the viewport, with its labels and its attribution, as a PNG"
        className="w-full rounded border border-slate-700 py-1 text-[11px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200 disabled:opacity-40"
      >
        {isExporting
          ? isPersian
            ? "در حال ذخیره…"
            : "Saving…"
          : isPersian
            ? "ذخیرهٔ نمای فعلی به‌عنوان تصویر"
            : "Save this view as an image"}
      </button>
      {exportOutcome && (
        <button
          type="button"
          onClick={() => setExportOutcome(null)}
          className="mt-1 block w-full truncate text-left text-[10px] text-slate-500 hover:text-slate-300"
          title={exportOutcome}
        >
          {exportOutcome}
        </button>
      )}
    </div>
  );
}

function StudyCoverageDisplay() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const isCoverageActive = useStudyStore((state) => state.coverageVisible);
  const setCoverageActive = useStudyStore((state) => state.setCoverageVisible);
  const coverageData = useStudyStore((state) => state.coverage);

  const maxTouches = busiestTouches(coverageData);
  const totalStudiedOrgans = Object.keys(coverageData).length;

  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={isCoverageActive}
          onChange={(event) => void setCoverageActive(event.target.checked)}
          className="accent-teal-400"
        />
        <span>{isPersian ? "نمایش بخش‌های مطالعه‌شده" : "Show what I have studied"}</span>
      </label>

      {!isCoverageActive && (
        <p className="text-[10px] leading-snug text-slate-600">
          Colours the body by your own notes and sessions, so the parts you have not
          worked on are the ones that stay grey.
        </p>
      )}

      {isCoverageActive && maxTouches === 0 && (
        <p className="text-[10px] leading-snug text-slate-600">
          Nothing filed against a structure yet. Write a note or ask about something
          with it selected, and it will start to show here.
        </p>
      )}

      {isCoverageActive && maxTouches > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center gap-2">
            {coverageLegend(maxTouches).map(({ label, hex }) => (
              <span key={label} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full ring-1 ring-inset ring-black/30"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-[9px] text-slate-500">{label}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] leading-snug text-slate-600">
            {totalStudiedOrgans} structure{totalStudiedOrgans === 1 ? "" : "s"} touched. The scale is
            relative to your own journal, not to the atlas — the brightest is
            whatever you have worked on most.
          </p>
        </div>
      )}
    </>
  );
}

function ExplodedViewSlider() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const explodeFactor = useSceneStore((state) => state.explode);
  const updateExplode = useSceneStore((state) => state.setExplode);
  const activeSelectedIds = useSceneStore((state) => state.selectedOrganIds);
  const activeIsolatedIds = useSceneStore((state) => state.isolatedOrganIds);

  const activeScope = explodeScope({
    selectedOrganIds: activeSelectedIds,
    isolatedOrganIds: activeIsolatedIds,
  });

  const subjectScopeDescription =
    activeScope === "selection"
      ? `the ${activeSelectedIds.length} structures you have selected`
      : activeScope === "region"
        ? `the ${activeIsolatedIds?.length ?? 0} parts you are studying`
        : "everything on screen";

  return (
    <section className="space-y-1 border-t border-slate-800 pt-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {isPersian ? "نمای بازشده" : "Exploded view"}
        </h2>
        {explodeFactor > 0 && (
          <button
            type="button"
            onClick={() => updateExplode(0)}
            className="ml-auto rounded border border-violet-700/70 bg-violet-600/15 px-2 py-0.5 text-[10px] text-violet-300"
          >
            {isPersian ? "بازگرداندن" : "Reassemble"}
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={MAX_EXPLODE}
        step={0.05}
        value={explodeFactor}
        aria-label="How far apart to push the parts"
        onChange={(event) => updateExplode(Number(event.target.value))}
        className="w-full accent-violet-500"
      />
      <p className="text-[10px] leading-snug text-slate-600">
        {isPersian ? (
          "اجزای انتخاب‌شده یا ساختارهای نمایش‌داده‌شده از مرکز خود فاصله می‌گیرند. برای بازگشت لغزنده را روی صفر قرار دهید؛ کلید X نیز مراحل را تغییر می‌دهد."
        ) : (
          <>
            Pushes {subjectScopeDescription} apart, away from its own centre, so you can see
            the faces that are normally pressed together. Nothing is hidden and nothing
            moves out of order — slide back to zero for the anatomy exactly as it was.{" "}
            <kbd>X</kbd> steps through it from the keyboard.
          </>
        )}
      </p>
    </section>
  );
}

/**
 * Hierarchical tree navigator for inspecting, isolating, toggling, and adjusting opacity of organ systems.
 */
export function AnatomyTree() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const organMap = useSceneStore((state) => state.organs);
  const hiddenSystems = useSceneStore((state) => state.hiddenSystems);
  const isolatedOrganIds = useSceneStore((state) => state.isolatedOrganIds);
  const selectedOrganIds = useSceneStore((state) => state.selectedOrganIds);
  const hiddenOrganIds = useSceneStore((state) => state.hiddenOrganIds);
  const hideConnective = useSceneStore((state) => state.hideConnective);
  const connectiveIds = useSceneStore((state) => state.connectiveIds);
  const setHideConnective = useSceneStore((state) => state.setHideConnective);
  const pathologyOverlays = useSceneStore((state) => state.pathologyOverlays);
  const activeCrossSection = useSceneStore((state) => state.crossSection);

  const [expandedSystemsMap, setExpandedSystemsMap] = useState<Record<string, boolean>>({});
  const selectOrgan = useSceneStore((state) => state.selectOrgan);
  const setHoveredOrganId = useSceneStore((state) => state.setHovered);
  const toggleSystemVisibility = useSceneStore((state) => state.toggleSystem);
  const isolateSystemAlone = useSceneStore((state) => state.soloSystem);
  const systemOpacityMap = useSceneStore((state) => state.systemOpacity);
  const stepSystemOpacity = useSceneStore((state) => state.cycleSystemOpacity);
  const applyXrayOnSystem = useSceneStore((state) => state.xraySystem);
  const isEyeTrackingActive = useSceneStore((state) => state.eyeTracking);
  const setEyeTrackingActive = useSceneStore((state) => state.setEyeTracking);
  const depthProbeVisible = useSceneStore((state) => state.depthProbeVisible);
  const setDepthProbeVisible = useSceneStore((state) => state.setDepthProbeVisible);
  const labelsVisible = useSceneStore((state) => state.labelsVisible);
  const setLabelsVisible = useSceneStore((state) => state.setLabelsVisible);
  const sceneBackground = useSceneStore((state) => state.background);
  const setSceneBackground = useSceneStore((state) => state.setBackground);
  const dispatchCommand = useSceneStore((state) => state.applyCommand);

  const groupedSystems = useMemo(() => {
    const buckets = new Map<AnatomicalSystem, ManifestOrgan[]>();
    for (const organ of Object.values(organMap)) {
      const currentList = buckets.get(organ.system) ?? [];
      currentList.push(organ);
      buckets.set(organ.system, currentList);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => organLabel(a).localeCompare(organLabel(b)));
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [organMap]);

  const hasAnyOpenFolder = groupedSystems.some(([system]) => systemIsOpen(expandedSystemsMap, system));
  const totalSystemOrgans = groupedSystems.reduce((acc, [, list]) => acc + list.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StructureSearch />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isPersian ? "دستگاه‌ها" : "Systems"}
            </h2>
            {groupedSystems.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setExpandedSystemsMap(
                    Object.fromEntries(groupedSystems.map(([sys]) => [sys, !hasAnyOpenFolder])),
                  )
                }
                title={
                  hasAnyOpenFolder
                    ? "Collapse every system"
                    : `Expand every system — ${totalSystemOrgans} structures`
                }
                className="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 transition hover:border-sky-600 hover:text-sky-300"
              >
                {hasAnyOpenFolder
                  ? isPersian
                    ? "بستن همه"
                    : "Collapse all"
                  : isPersian
                    ? "باز کردن همه"
                    : "Expand all"}
              </button>
            )}
          </div>

          {groupedSystems.map(([systemKey, organList]) => {
            const isSystemFolderOpen = systemIsOpen(expandedSystemsMap, systemKey);
            return (
              <div key={systemKey} className="mb-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={!hiddenSystems.includes(systemKey)}
                    onChange={() => toggleSystemVisibility(systemKey)}
                    title={
                      hiddenSystems.includes(systemKey)
                        ? "Load and show this system"
                        : "Hide this system"
                    }
                    className="accent-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSystemsMap((prev) => ({
                        ...prev,
                        [systemKey]: !isSystemFolderOpen,
                      }))
                    }
                    className="flex flex-1 items-center gap-1.5 text-left hover:text-sky-300"
                    aria-expanded={isSystemFolderOpen}
                  >
                    <span className="w-2 text-[9px] text-slate-500">
                      {isSystemFolderOpen ? "▼" : "▶"}
                    </span>
                    <span
                      aria-hidden
                      title={`${SYSTEM_LABELS[systemKey]} — the colour key in the viewport names every tissue on screen`}
                      className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/30"
                      style={{ backgroundColor: SYSTEM_COLOURS[systemKey] }}
                    />
                    <span className="capitalize">
                      {isPersian ? (PERSIAN_SYSTEM_NAMES[systemKey] ?? systemKey) : systemKey}
                    </span>
                    <span className="ml-auto text-xs text-slate-500">{organList.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => stepSystemOpacity(systemKey)}
                    title={
                      systemOpacityMap[systemKey] === undefined
                        ? `Make ${systemKey} translucent — see what is under it`
                        : `${systemKey} is at ${Math.round(systemOpacityMap[systemKey]! * 100)}% — click for less, again for solid`
                    }
                    className={`shrink-0 rounded border px-1 py-0.5 text-[9px] leading-none ${
                      systemOpacityMap[systemKey] === undefined
                        ? "border-slate-700 text-slate-500 hover:border-sky-600 hover:text-sky-300"
                        : "border-sky-700/70 bg-sky-600/15 text-sky-300"
                    }`}
                  >
                    ◐
                  </button>
                  <button
                    type="button"
                    onClick={() => applyXrayOnSystem(systemKey)}
                    title={`Keep ${systemKey} solid and ghost everything else`}
                    className="shrink-0 rounded border border-slate-700 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 hover:border-sky-600 hover:text-sky-300"
                  >
                    {isPersian ? "شفاف‌سازی" : "X-ray"}
                  </button>
                  <button
                    type="button"
                    onClick={() => isolateSystemAlone(systemKey)}
                    title={`Study ${systemKey} on its own`}
                    className="shrink-0 rounded border border-slate-700 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 hover:border-sky-600 hover:text-sky-300"
                  >
                    {isPersian ? "تکی" : "Solo"}
                  </button>
                </div>

                {isSystemFolderOpen && (
                  <ul className="ml-5 space-y-0.5">
                    {organList.map((organItem) => {
                      const isEntityVisible = isOrganVisible(
                        {
                          hiddenSystems,
                          isolatedOrganIds,
                          hiddenOrganIds,
                          hideConnective,
                          connectiveIds,
                        },
                        organItem,
                      );
                      const activeOverlay = pathologyOverlays[organItem.organ_id];
                      const isSelected = selectedOrganIds.includes(organItem.organ_id);

                      return (
                        <li key={organItem.organ_id}>
                          <button
                            type="button"
                            onMouseEnter={() => setHoveredOrganId(organItem.organ_id)}
                            onMouseLeave={() => setHoveredOrganId(null)}
                            onClick={(event) =>
                              selectOrgan(organItem.organ_id, event.ctrlKey || event.metaKey)
                            }
                            className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition ${
                              isSelected
                                ? "bg-sky-500/15 text-sky-300"
                                : "text-slate-400 hover:bg-slate-800/60"
                            } ${isEntityVisible ? "" : "opacity-40"}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate italic">{organLabel(organItem)}</span>
                              <span className="block truncate text-[10px] text-slate-500">
                                {organSubtitle(organItem)}
                              </span>
                            </span>
                            {activeOverlay && (
                              <span
                                className="shrink-0 text-[10px] text-amber-400"
                                title={`${activeOverlay.pathology} (${Math.round(activeOverlay.severity * 100)}%)`}
                              >
                                ●
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        <section className="space-y-1 border-t border-slate-800 pt-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {isPersian ? "نمایش" : "View"}
          </h2>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={isEyeTrackingActive}
              onChange={(event) => setEyeTrackingActive(event.target.checked)}
              className="accent-sky-500"
            />
            <span>{isPersian ? "حرکت چشم‌ها با دوربین" : "Eyes follow you"}</span>
          </label>
          <p className="text-[10px] leading-snug text-slate-600">
            {isPersian
              ? "چشم‌ها در حد تقریبی ۳۵ درجه در حدقه حرکت می‌کنند."
              : "The globes turn in their orbits, up to about 35° — as far as a real eye goes before the head has to follow."}
          </p>

          <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={labelsVisible}
              onChange={(event) => setLabelsVisible(event.target.checked)}
              className="accent-sky-500"
            />
            <span>{isPersian ? "نمایش نام ساختار انتخاب‌شده" : "Label what I select"}</span>
          </label>
          <p className="text-[10px] leading-snug text-slate-600">
            {isPersian
              ? "نام ساختارهای انتخاب‌شده با خط راهنما در کنار مدل نمایش داده می‌شود."
              : "Names in the margins with a leader line to each structure, the way an atlas plate does it. Select structures — or isolate a region — to name them."}
          </p>

          <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={depthProbeVisible}
              onChange={(event) => setDepthProbeVisible(event.target.checked)}
              className="accent-sky-500"
            />
            <span>{isPersian ? "فهرست ساختارهای زیر نشانگر" : "List what is under the cursor"}</span>
          </label>
          <p className="text-[10px] leading-snug text-slate-600">
            {isPersian
              ? "پنل سمت راست ساختارهای زیر نشانگر را از سطح به عمق فهرست می‌کند. در صفحهٔ کوچک می‌توانید آن را از اینجا یا منوی راست‌کلیک خاموش کنید."
              : "The panel on the right, naming everything the cursor passes through from the surface inwards. On a small screen it can be switched off here or from the right-click menu."}
          </p>

          <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={hideConnective}
              onChange={(event) => setHideConnective(event.target.checked)}
              className="accent-sky-500"
            />
            <span>{isPersian ? "پنهان‌کردن تاندون‌ها و فاشیا" : "Take off the tendons & fascia"}</span>
          </label>
          <p className="text-[10px] leading-snug text-slate-600">
            {isPersian
              ? "لایه‌های تاندونی و فاشیا روی عضلات قرار دارند؛ با پنهان‌کردن آن‌ها عضلات زیرین دیده می‌شوند."
              : "The muscular system carries 116 sheets — the pectoral fascia, the rectus sheath, the fascia lata — lying directly on the muscles they wrap. Take them off to see the muscles underneath."}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-300">{isPersian ? "پس‌زمینه" : "Background"}</span>
            <div className="ml-auto flex overflow-hidden rounded border border-slate-700">
              {(["dark", "light"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSceneBackground(mode)}
                  aria-pressed={sceneBackground === mode}
                  title={
                    mode === "dark"
                      ? "Easier on the eye for a long session"
                      : "For handouts, slides and anything not itself dark"
                  }
                  className={`px-2 py-0.5 text-[10px] capitalize transition ${
                    sceneBackground === mode
                      ? "bg-slate-700/70 text-slate-100"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {isPersian ? (mode === "dark" ? "تیره" : "روشن") : mode}
                </button>
              ))}
            </div>
          </div>

          <StudyCoverageDisplay />
          <ViewportCaptureButton />
        </section>

        <section className="space-y-2 border-t border-slate-800 pt-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {isPersian ? "برش مقطعی" : "Cross-section"}
          </h2>
          <div className="flex gap-1">
            {SECTION_PLANES_LIST.map((plane) => (
              <button
                key={plane}
                type="button"
                onClick={() =>
                  dispatchCommand({
                    action: "set_cross_section",
                    plane,
                    position:
                      activeCrossSection?.plane === plane ? activeCrossSection.position : 0,
                  })
                }
                className={`flex-1 rounded border px-2 py-1 text-xs capitalize ${
                  activeCrossSection?.plane === plane
                    ? "border-sky-500 bg-sky-500/10 text-sky-300"
                    : "border-slate-700 text-slate-400"
                }`}
              >
                {isPersian
                  ? ({ axial: "افقی", coronal: "تاجی", sagittal: "سهمی" } as const)[plane]
                  : plane}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={activeCrossSection?.position ?? 0}
            disabled={!activeCrossSection}
            onChange={(e) =>
              activeCrossSection &&
              dispatchCommand({
                action: "set_cross_section",
                plane: activeCrossSection.plane,
                position: Number(e.target.value),
              })
            }
            className="w-full accent-sky-500 disabled:opacity-30"
          />
        </section>

        <ExplodedViewSlider />
      </div>
    </div>
  );
}

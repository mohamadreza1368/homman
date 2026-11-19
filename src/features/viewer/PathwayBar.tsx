import type { AnatomicalSystem } from "@/lib/schemas";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useDraggablePanel } from "./useDraggablePanel";

/** Storage identifier for preserving the pathway status pill position. */
const STORAGE_DRAG_KEY = "hoomaan.pathwayBar.v1";

/**
 * Identifies anatomical systems required by a pathway that are currently hidden in the viewport.
 * Returns unique systems in the order they first occur along the trajectory.
 */
export function unloadedSystems(
  stops: { system: AnatomicalSystem }[],
  hiddenSystems: AnatomicalSystem[],
): AnatomicalSystem[] {
  if (hiddenSystems.length === 0 || stops.length === 0) return [];
  const hiddenLookup = new Set(hiddenSystems);
  const seen = new Set<AnatomicalSystem>();
  const missing: AnatomicalSystem[] = [];

  for (const { system } of stops) {
    if (hiddenLookup.has(system) && !seen.has(system)) {
      seen.add(system);
      missing.push(system);
    }
  }

  return missing;
}

/**
 * Floating status dock displayed during animated pathway tracking.
 * Provides controls to replay, cancel, inspect stops, or re-enable missing systems.
 */
export function PathwayBar() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const activePathway = useSceneStore((state) => state.pathway);
  const organRegistry = useSceneStore((state) => state.organs);
  const hiddenSystemList = useSceneStore((state) => state.hiddenSystems);
  const toggleSystemVisibility = useSceneStore((state) => state.toggleSystem);
  const dismissPathway = useSceneStore((state) => state.clearPathway);
  const dispatchCommand = useSceneStore((state) => state.applyCommand);

  const { ref, position, moved, reset, handleProps } = useDraggablePanel(STORAGE_DRAG_KEY);

  if (!activePathway) return null;

  const validStops = activePathway.organIds
    .map((organId) => organRegistry[organId])
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const missingSystems = unloadedSystems(validStops, hiddenSystemList);

  const containerCoords = position
    ? { left: position.x, top: position.y }
    : { right: 12, top: 44 };

  const restartPathway = () => {
    dispatchCommand({
      action: "highlight_pathway",
      label: activePathway.label,
      organ_ids: activePathway.organIds,
      step_seconds: activePathway.stepSeconds,
      loop: activePathway.loop,
    });
  };

  return (
    <aside
      ref={ref}
      style={containerCoords}
      aria-label={isPersian ? "نوار رهگیری مسیر" : "Pathway tracking bar"}
      className="pointer-events-auto absolute w-64 overflow-hidden rounded-lg border border-fuchsia-800/60 bg-slate-900/95 shadow-lg backdrop-blur"
    >
      <div
        {...handleProps}
        onDoubleClick={reset}
        title={isPersian ? "برای جابه‌جایی بکشید · دو بار کلیک برای بازنشانی" : "Drag to move · double-click to put it back"}
        className="flex cursor-grab items-center gap-2 px-2.5 py-1.5 active:cursor-grabbing"
      >
        <span aria-hidden="true" className="select-none text-[10px] leading-none text-slate-600">
          ⠿
        </span>
        <span className="shrink-0 rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300">
          {isPersian ? "مسیر" : "Pathway"}
        </span>

        {moved && (
          <button
            type="button"
            onClick={reset}
            title={isPersian ? "بازگردانی به موقعیت اولیه" : "Put the badge back where it started"}
            className="shrink-0 rounded px-1 text-[9px] text-slate-600 transition hover:text-slate-300"
          >
            {isPersian ? "بازنشانی" : "reset"}
          </button>
        )}

        <button
          type="button"
          onClick={restartPathway}
          title={isPersian ? "تکرار مسیر از آغاز" : "Trace it again from the start"}
          className="ml-auto shrink-0 rounded px-1 text-[10px] text-slate-500 transition hover:text-fuchsia-200"
        >
          {isPersian ? "پخش مجدد" : "replay"}
        </button>

        <button
          type="button"
          onClick={dismissPathway}
          title={isPersian ? "توقف رهگیری مسیر" : "Stop tracing this route"}
          aria-label="Stop tracing this route"
          className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] leading-none text-slate-400 transition hover:border-fuchsia-600 hover:text-fuchsia-200"
        >
          ✕
        </button>
      </div>

      <div className="border-t border-slate-800 px-2.5 py-1.5">
        <p className="text-[11px] font-medium text-slate-200">{activePathway.label}</p>

        {validStops.length > 0 && (
          <p className="mt-1 max-h-24 overflow-y-auto text-[10px] italic leading-snug text-slate-500">
            {validStops.map(organLabel).join(" → ")}
          </p>
        )}

        {missingSystems.length > 0 && (
          <p className="mt-1.5 text-[10px] leading-snug text-amber-400">
            {isPersian
              ? "بخشی از این مسیر در دیدرس نیست — "
              : "Part of this route is not on screen — "}
            {missingSystems.map((systemId, index) => (
              <span key={systemId}>
                {index > 0 && ", "}
                <button
                  type="button"
                  onClick={() => toggleSystemVisibility(systemId)}
                  className="underline decoration-dotted underline-offset-2 hover:text-amber-300"
                >
                  {isPersian ? `فعال‌سازی ${systemId}` : `switch on ${systemId}`}
                </button>
              </span>
            ))}
          </p>
        )}
      </div>
    </aside>
  );
}

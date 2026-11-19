import { useMemo } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { tissueFamily, type TissueFamily } from "./palette";
import { useDraggablePanel, useRememberedFlag } from "./useDraggablePanel";

const LEGEND_STORAGE_POSITION = "hoomaan.legend.v1";
const LEGEND_STORAGE_COLLAPSED = "hoomaan.legend.collapsed.v1";

interface AggregatedFamily extends TissueFamily {
  count: number;
}

/**
 * Draggable floating legend summarizing tissue classes, histological colors,
 * and component counts currently visible in the 3D viewport.
 */
export function ColourLegend() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const catalog = useSceneStore((state) => state.organs);
  const hiddenSystems = useSceneStore((state) => state.hiddenSystems);
  const isolatedOrgans = useSceneStore((state) => state.isolatedOrganIds);
  const hiddenOrgans = useSceneStore((state) => state.hiddenOrganIds);

  const [isCollapsed, setIsCollapsed] = useRememberedFlag(LEGEND_STORAGE_COLLAPSED, true);
  const { ref, position, moved, reset, handleProps } = useDraggablePanel(LEGEND_STORAGE_POSITION);

  // Group and count active organs by histological/tissue family
  const visibleTissueFamilies = useMemo(() => {
    const hiddenSystemsLookup = new Set(hiddenSystems);
    const hiddenOrgansLookup = new Set(hiddenOrgans);
    const isolatedLookup = isolatedOrgans ? new Set(isolatedOrgans) : null;

    const familyMap = new Map<string, AggregatedFamily>();

    for (const organ of Object.values(catalog)) {
      if (hiddenSystemsLookup.has(organ.system)) continue;
      if (hiddenOrgansLookup.has(organ.organ_id)) continue;
      if (isolatedLookup && !isolatedLookup.has(organ.organ_id)) continue;

      const familyInfo = tissueFamily(organ);
      const existing = familyMap.get(familyInfo.id);
      if (existing) {
        existing.count += 1;
      } else {
        familyMap.set(familyInfo.id, { ...familyInfo, count: 1 });
      }
    }

    return Array.from(familyMap.values()).sort((a, b) => {
      const diff = b.count - a.count;
      return diff !== 0 ? diff : a.label.localeCompare(b.label);
    });
  }, [catalog, hiddenSystems, isolatedOrgans, hiddenOrgans]);

  if (visibleTissueFamilies.length === 0) {
    return null;
  }

  const offsetStyle = position
    ? { left: position.x, top: position.y }
    : { left: 12, top: 44 };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <aside
        ref={ref}
        dir={isPersian ? "rtl" : "ltr"}
        style={offsetStyle}
        aria-label={isPersian ? "راهنمای رنگ بافت‌ها" : "Tissue colour key"}
        className="pointer-events-auto absolute w-52 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/90 shadow-lg backdrop-blur"
      >
        <div
          {...handleProps}
          onDoubleClick={reset}
          title={
            isPersian
              ? "برای جابه‌جایی بکشید · دابل‌کلیک برای بازگرداندن"
              : "Drag to move · double-click to put it back"
          }
          className="flex cursor-grab items-center gap-1.5 px-2 py-1 active:cursor-grabbing"
        >
          <span aria-hidden="true" className="select-none text-[10px] leading-none text-slate-600">
            ⠿
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            {isPersian ? "راهنمای رنگ" : "Colour key"}
          </span>
          <span className="text-[9px] text-slate-600">{visibleTissueFamilies.length}</span>

          {moved && (
            <button
              type="button"
              onClick={reset}
              title={isPersian ? "بازگردانی به جای اولیه" : "Put the legend back where it started"}
              className="ms-auto rounded px-1 text-[9px] text-slate-600 transition hover:text-slate-300"
            >
              {isPersian ? "بازنشانی" : "reset"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
            title={
              isPersian
                ? isCollapsed
                  ? "نمایش راهنمای رنگ"
                  : "جمع‌کردن راهنمای رنگ"
                : isCollapsed
                  ? "Show the colour key"
                  : "Collapse the colour key"
            }
            className={`rounded px-1 text-[10px] text-slate-500 transition hover:text-slate-200 ${
              moved ? "" : "ms-auto"
            }`}
          >
            {isCollapsed ? "▾" : "▴"}
          </button>
        </div>

        {!isCollapsed && (
          <ul className="max-h-[42vh] space-y-0.5 overflow-y-auto border-t border-slate-800 px-2 py-1.5">
            {visibleTissueFamilies.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/30"
                  style={{ backgroundColor: entry.hex }}
                />
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
                  {entry.label}
                </span>
                <span className="shrink-0 text-[9px] tabular-nums text-slate-600">
                  {entry.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

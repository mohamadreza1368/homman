import { useMemo } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";

import { tissueFamily, type TissueFamily } from "./palette";
import { useDraggablePanel, useRememberedFlag } from "./useDraggablePanel";

const POSITION_KEY = "anatria3d.legend.v1";
const COLLAPSED_KEY = "anatria3d.legend.collapsed.v1";

export function ColourLegend() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const organs = useSceneStore((s) => s.organs);
  const hiddenSystems = useSceneStore((s) => s.hiddenSystems);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const hiddenOrganIds = useSceneStore((s) => s.hiddenOrganIds);

  const [collapsed, setCollapsed] = useRememberedFlag(COLLAPSED_KEY, true);
  const { ref, position, moved, reset, handleProps } = useDraggablePanel(POSITION_KEY);

  const families = useMemo(() => {
    const hiddenSystemSet = new Set(hiddenSystems);
    const hiddenOrganSet = new Set(hiddenOrganIds);
    const isolatedSet = isolatedOrganIds === null ? null : new Set(isolatedOrganIds);

    const counted = new Map<string, TissueFamily & { count: number }>();
    for (const organ of Object.values(organs)) {
      if (hiddenSystemSet.has(organ.system)) continue;
      if (hiddenOrganSet.has(organ.organ_id)) continue;
      if (isolatedSet && !isolatedSet.has(organ.organ_id)) continue;

      const family = tissueFamily(organ);
      const entry = counted.get(family.id);
      if (entry) entry.count += 1;
      else counted.set(family.id, { ...family, count: 1 });
    }

    return [...counted.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    );
  }, [organs, hiddenSystems, isolatedOrganIds, hiddenOrganIds]);

  if (families.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        dir={fa ? "rtl" : "ltr"}
        ref={ref}
        style={position ? { left: position.x, top: position.y } : { left: 12, top: 44 }}
        className="pointer-events-auto absolute w-52 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/90 shadow-lg backdrop-blur"
      >
        <div
          {...handleProps}
          onDoubleClick={reset}
          title={fa ? "برای جابه‌جایی بکشید · دابل‌کلیک برای بازگرداندن" : "Drag to move · double-click to put it back"}
          className="flex cursor-grab items-center gap-1.5 px-2 py-1 active:cursor-grabbing"
        >
          <span aria-hidden className="select-none text-[10px] leading-none text-slate-600">
            ⠿
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            {fa ? "راهنمای رنگ" : "Colour key"}
          </span>
          <span className="text-[9px] text-slate-600">{families.length}</span>

          {moved && (
            <button
              type="button"
              onClick={reset}
              title={fa ? "بازگردانی به جای اولیه" : "Put the legend back where it started"}
              className="ms-auto rounded px-1 text-[9px] text-slate-600 transition hover:text-slate-300"
            >
              {fa ? "بازنشانی" : "reset"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            title={fa ? (collapsed ? "نمایش راهنمای رنگ" : "جمع‌کردن راهنمای رنگ") : collapsed ? "Show the colour key" : "Collapse the colour key"}
            className={`rounded px-1 text-[10px] text-slate-500 transition hover:text-slate-200 ${
              moved ? "" : "ms-auto"
            }`}
          >
            {collapsed ? "▾" : "▴"}
          </button>
        </div>

        {!collapsed && (
          <ul className="max-h-[42vh] space-y-0.5 overflow-y-auto border-t border-slate-800 px-2 py-1.5">
            {families.map((family) => (
              <li key={family.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/30"
                  style={{ backgroundColor: family.hex }}
                />
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
                  {family.label}
                </span>
                <span className="shrink-0 text-[9px] tabular-nums text-slate-600">
                  {family.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

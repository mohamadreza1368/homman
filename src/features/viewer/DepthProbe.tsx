import { organLabel, organSubtitle, useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import { depthReadingState, DISMISS_HINT, HEADING, SUBHEADING } from "./depthReading";
import { MAX_STACK } from "./depthStack";
import { tissueHex } from "./palette";

/**
 * HOOMAAN Anatomical Depth Probe Panel.
 * Inspects raycasted tissue layers beneath the pointer from superficial to deep,
 * enabling progressive selection, multi-layer isolation, and focused inspection.
 */

export function DepthProbe() {
  const isProbeVisible = useSceneStore((s) => s.depthProbeVisible);
  const liveStack = useSceneStore((s) => s.depthStack);
  const pinnedStack = useSceneStore((s) => s.pinnedStack);
  const dismissProbe = useSceneStore((s) => s.dismissDepthStack);
  const organDirectory = useSceneStore((s) => s.organs);
  const hoveredId = useSceneStore((s) => s.hoveredOrganId);
  const setHoveredId = useSceneStore((s) => s.setHovered);
  const dispatchCommand = useSceneStore((s) => s.applyCommand);
  const selectedIds = useSceneStore((s) => s.selectedOrganIds);
  const selectOrgan = useSceneStore((s) => s.selectOrgan);
  const isPersian = useInterfaceLanguage((s) => s.language === "fa");

  const currentIds = pinnedStack ?? liveStack;
  const probeState = depthReadingState(pinnedStack !== null);
  const layers = currentIds.map((id) => organDirectory[id]).filter((o) => !!o);
  const selectedSet = new Set(selectedIds);
  const matchingSelectedCount = layers.filter((o) => selectedSet.has(o.organ_id)).length;

  if (!isProbeVisible) return null;
  if (layers.length < 2) return null;

  return (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
      <div
        className={`pointer-events-auto w-60 overflow-hidden rounded-lg border bg-slate-900/90 shadow-lg backdrop-blur transition-colors ${
          probeState === "live" ? "border-slate-700/80" : "border-sky-700/70"
        }`}
      >
        <p className="flex items-center gap-1.5 border-b border-slate-800 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {isPersian
            ? probeState === "live"
              ? "لایه‌های زیر مکان‌نما"
              : "مسیر ساختار کلیک‌شده"
            : HEADING[probeState]}
          <span className="font-normal normal-case tracking-normal text-slate-600">
            {isPersian
              ? probeState === "live"
                ? "از سطح به عمق"
                : "ثابت‌شده — جابه‌جایی آزاد"
              : SUBHEADING[probeState]}
          </span>
          <button
            type="button"
            onClick={dismissProbe}
            title={
              isPersian
                ? probeState === "live"
                  ? "بستن این سنجش"
                  : "رهاسازی این سنجش"
                : DISMISS_HINT[probeState]
            }
            className="ml-auto rounded px-1 text-slate-600 transition hover:text-slate-200"
          >
            ✕
          </button>
        </p>

        <ol className="max-h-[46vh] overflow-y-auto py-1">
          {layers.map((organ, index) => {
            const isSelected = selectedSet.has(organ.organ_id);
            return (
              <li
                key={organ.organ_id}
                className={`group flex items-stretch border-l-2 ${
                  isSelected ? "border-sky-500/70" : "border-transparent"
                }`}
              >
                <button
                  type="button"
                  onMouseEnter={() => setHoveredId(organ.organ_id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      selectOrgan(organ.organ_id, true);
                      return;
                    }
                    dispatchCommand({ action: "focus_organ", organ_id: organ.organ_id });
                  }}
                  title={
                    isPersian
                      ? `${organSubtitle(organ)} — با Ctrl+کلیک به انتخاب اضافه کنید`
                      : `${organSubtitle(organ)} — Ctrl-click to add it to the selection`
                  }
                  className={`flex min-w-0 flex-1 items-center gap-2 py-1 pl-2.5 pr-1 text-left transition ${
                    hoveredId === organ.organ_id
                      ? "bg-sky-600/20"
                      : isSelected
                        ? "bg-sky-500/10"
                        : "hover:bg-slate-800/70"
                  }`}
                >
                  <span
                    className={`w-3 shrink-0 text-right text-[9px] tabular-nums ${
                      isSelected ? "text-sky-300" : "text-slate-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/40"
                    style={{ backgroundColor: tissueHex(organ) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] italic text-slate-200">
                      {organLabel(organ)}
                    </span>
                    <span className="block truncate text-[9px] text-slate-500">
                      {organSubtitle(organ)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onMouseEnter={() => setHoveredId(organ.organ_id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() =>
                    dispatchCommand({
                      action: "isolate_structures",
                      organ_ids: [organ.organ_id],
                    })
                  }
                  title={
                    isPersian
                      ? `نمایش فقط ${organLabel(organ)} — با Esc برمی‌گردد`
                      : `Show only ${organLabel(organ)} — Esc restores`
                  }
                  className="shrink-0 px-1.5 text-[8px] uppercase tracking-wide text-slate-700 opacity-0 transition group-hover:opacity-100 hover:text-sky-300 focus-visible:opacity-100"
                >
                  {isPersian ? "تک" : "solo"}
                </button>
              </li>
            );
          })}
        </ol>

        <p className="border-t border-slate-800 px-2.5 py-1 text-[9px] text-slate-600">
          {matchingSelectedCount > 0
            ? isPersian
              ? `${matchingSelectedCount} مورد انتخاب شده — برای جداسازی کلید I را بزنید`
              : `${matchingSelectedCount} of these selected — press I to isolate`
            : isPersian
              ? "با Ctrl+کلیک سطر مورد نظر را به انتخاب اضافه کنید"
              : "Ctrl-click a line to add it to the selection"}
        </p>

        {layers.length > 1 && (
          <button
            type="button"
            onClick={() =>
              dispatchCommand({
                action: "isolate_structures",
                organ_ids: layers.map((o) => o.organ_id),
              })
            }
            title={
              isPersian
                ? "فقط ساختارهای واقع در مسیر شعاع باقی می‌مانند — با Esc برمی‌گردد"
                : "Leave only what the ray crosses — Esc restores"
            }
            className="w-full border-t border-slate-800 px-2.5 py-1 text-left text-[9px] uppercase tracking-wide text-slate-500 transition hover:bg-slate-800/60 hover:text-sky-300"
          >
            {isPersian ? `جداسازی این ${layers.length} ساختار` : `Isolate these ${layers.length}`}
          </button>
        )}

        {layers.length >= MAX_STACK && (
          <p className="border-t border-slate-800 px-2.5 py-1 text-[9px] text-slate-600">
            {isPersian
              ? `نزدیک‌ترین ${MAX_STACK} لایه — شعاع به عمق بیشتری نفوذ کرده است.`
              : `Nearest ${MAX_STACK} — the ray goes deeper than this.`}
          </p>
        )}
      </div>
    </div>
  );
}

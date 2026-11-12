import { useEffect } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, organSubtitle, useSceneStore } from "@/stores/sceneStore";

import { viewportKey } from "./viewportKeys";

export function SelectionBar() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);
  const hiddenOrganIds = useSceneStore((s) => s.hiddenOrganIds);
  const organs = useSceneStore((s) => s.organs);
  const isolateSelection = useSceneStore((s) => s.isolateSelection);
  const hideSelection = useSceneStore((s) => s.hideSelection);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const unhideAll = useSceneStore((s) => s.unhideAll);
  const setHovered = useSceneStore((s) => s.setHovered);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = viewportKey(event);
      if (key === null) return;
      if (key === "i") isolateSelection();
      else if (key === "h") hideSelection();
      else if (key === "u") unhideAll();
      else if (key === "c") clearSelection();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isolateSelection, hideSelection, unhideAll, clearSelection]);

  const chosen = selectedOrganIds.map((id) => organs[id]).filter((organ) => !!organ);
  if (chosen.length === 0 && hiddenOrganIds.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
      <div className="pointer-events-auto flex max-w-[85%] items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-1.5 shadow-lg backdrop-blur">
        {chosen.length > 0 && (
          <>
            <span className="shrink-0 rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
              {fa ? `${chosen.length} انتخاب‌شده` : `${chosen.length} selected`}
            </span>

            <div className="flex min-w-0 items-center gap-1">
              {chosen.slice(-3).map((organ) => (
                <span
                  key={organ.organ_id}
                  title={organSubtitle(organ)}
                  onMouseEnter={() => setHovered(organ.organ_id)}
                  onMouseLeave={() => setHovered(null)}
                  className="max-w-44 truncate text-xs italic text-slate-300"
                >
                  {organLabel(organ)}
                </span>
              ))}
            </div>

            <Action onClick={isolateSelection} hint="I">
              {fa ? "ایزوله" : "Isolate"}
            </Action>
            <Action onClick={hideSelection} hint="H">
              {fa ? "پنهان" : "Hide"}
            </Action>
            <Action onClick={clearSelection} hint="C">
              {fa ? "پاک کردن" : "Clear"}
            </Action>
          </>
        )}

        {hiddenOrganIds.length > 0 && (
          <Action onClick={unhideAll} hint="U" tone="amber">
            {fa ? `بازگردانی ${hiddenOrganIds.length} پنهان` : `Restore ${hiddenOrganIds.length} hidden`}
          </Action>
        )}
      </div>
    </div>
  );
}

function Action({
  children,
  onClick,
  hint,
  tone = "slate",
}: {
  children: React.ReactNode;
  onClick: () => void;
  hint?: string;
  tone?: "slate" | "amber";
}) {
  const palette =
    tone === "amber"
      ? "border-amber-700/60 text-amber-300 hover:border-amber-500"
      : "border-slate-700 text-slate-300 hover:border-sky-600 hover:text-sky-200";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[10px] ${palette}`}
    >
      {children}
      {hint && (
        <kbd className="rounded bg-slate-800 px-1 text-[9px] text-slate-500">{hint}</kbd>
      )}
    </button>
  );
}

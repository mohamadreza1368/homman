import { useEffect, useState } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";

import { explodeScope, MAX_EXPLODE } from "./explode";
import { viewportKey } from "./viewportKeys";

export function ExplodeBar() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const explode = useSceneStore((s) => s.explode);
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const cycleExplode = useSceneStore((s) => s.cycleExplode);
  const setExplode = useSceneStore((s) => s.setExplode);

  const [held, setHeld] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!held) return;
    const release = () => setHeld(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [held]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (viewportKey(event) !== "x") return;
      event.preventDefault();
      cycleExplode();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleExplode]);

  if (explode <= 0 && !held && !focused) return null;

  const scope = explodeScope({ selectedOrganIds, isolatedOrganIds });
  const subject = fa
    ? scope === "selection"
      ? `${selectedOrganIds.length} انتخاب‌شده`
      : scope === "region"
        ? `${isolatedOrganIds?.length ?? 0} ایزوله‌شده`
        : "کل بدن"
    : scope === "selection"
      ? `${selectedOrganIds.length} selected`
      : scope === "region"
        ? `${isolatedOrganIds?.length ?? 0} isolated`
        : "the whole body";

  return (
    <div className="pointer-events-none absolute bottom-14 right-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-violet-800/70 bg-slate-900/95 px-3 py-1.5 shadow-lg backdrop-blur">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            explode > 0
              ? "bg-violet-500/20 text-violet-300"
              : "bg-slate-700/50 text-slate-400"
          }`}
        >
          {fa ? (explode > 0 ? "بازشده" : "کامل") : explode > 0 ? "Exploded" : "Whole"}
        </span>
        <span className="text-[11px] text-slate-400">{subject}</span>
        <input
          type="range"
          min={0}
          max={MAX_EXPLODE}
          step={0.05}
          value={explode}
          aria-label={fa ? "میزان باز شدن اجزا" : "How far apart to push the parts"}
          title={fa ? "برای بازشدن اجزا بکشید — کلید X" : "Drag to set the separation — X steps through it from the keyboard"}
          onChange={(event) => setExplode(Number(event.target.value))}
          onPointerDown={() => setHeld(true)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="h-1 w-28 cursor-ew-resize accent-violet-500"
        />
        <button
          type="button"
          onClick={() => setExplode(0)}
          title={fa ? "بازگرداندن اجزا به جای اولیه" : "Put every part back where the body keeps it"}
          className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-violet-600 hover:text-violet-200"
        >
          {fa ? "جمع کردن" : "Reassemble"}
        </button>
      </div>
    </div>
  );
}

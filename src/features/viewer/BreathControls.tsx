import { useEffect, useState } from "react";

import { useBreathStore } from "@/stores/breathStore";
import { useHeartStore } from "@/stores/heartStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";

import { BREATH_NOW } from "./BreathDriver";
import { BREATH_PATTERNS, type BreathPatternId } from "./breathing";
import { OVERLAY_SWITCH_OFF, OVERLAY_SWITCH_ON } from "./overlayChrome";
import { rhythm } from "./rhythms";

const PHASE = {
  in: "Breathing in — the diaphragm contracts and descends; the ribs swing up and out.",
  out: "Breathing out — at rest no muscle works: the lungs and the chest wall recoil.",
};

const PHASE_FA = {
  in: "دم — دیافراگم منقبض و پایین می‌آید و دنده‌ها بالا و بیرون می‌روند.",
  out: "بازدم — در استراحت، ریه‌ها و قفسهٔ سینه به‌صورت کشسانی بازمی‌گردند.",
};

const ORDER: BreathPatternId[] = ["quiet", "deep"];

function useBreathPhase(active: boolean): "in" | "out" {
  const [phase, setPhase] = useState<"in" | "out">("in");
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const read = () => {
      const now = BREATH_NOW.inhaling ? "in" : "out";
      setPhase((before) => (before === now ? before : now));
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return phase;
}

export function BreathControls() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const enabled = useBreathStore((s) => s.enabled);
  const patternId = useBreathStore((s) => s.pattern);
  const toggle = useBreathStore((s) => s.toggle);
  const setPattern = useBreathStore((s) => s.setPattern);
  const lungsHidden = useSceneStore((s) => s.hiddenSystems.includes("respiratory"));
  const heartFollows = useHeartStore((s) => s.enabled && (rhythm(s.rhythm).followsBreath ?? 0) > 0);
  const phase = useBreathPhase(enabled);
  const pattern = BREATH_PATTERNS[patternId];

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        title={
          fa
            ? enabled
              ? "توقف تنفس"
              : "پویانمایی تنفس: حرکت دیافراگم، پرشدن ریه‌ها و دنده‌ها"
            : enabled
              ? "Stop the breathing"
              : "Breathe: the diaphragm descends, the lungs fill, the ribs lift"
        }
        className={`rounded border px-2 py-1 text-xs ${enabled ? OVERLAY_SWITCH_ON.sky : OVERLAY_SWITCH_OFF}`}
      >
        {fa ? "تنفس" : "Breathing"}
      </button>

      {enabled && (
        <div dir={fa ? "rtl" : "ltr"} className="max-w-52 rounded border border-sky-900/60 bg-slate-950/80 px-2 py-1.5 text-[9px] leading-snug text-slate-400">
          <p className="uppercase tracking-wider text-sky-300/80">
            {pattern.rate} · {fa ? "نمایشی" : "illustrative"}
          </p>
          <p className="mt-0.5 font-medium text-slate-200">{pattern.label}</p>
          <p className="mt-0.5" aria-live="off">{fa ? PHASE_FA[phase] : PHASE[phase]}</p>
          <p className="mt-0.5 text-slate-500">{pattern.what}</p>
          {heartFollows && (
            <p className="mt-0.5 text-rose-300/80">
              {fa
                ? "ضربان قلب هنگام دم کمی تندتر و هنگام بازدم کندتر می‌شود."
                : `The heart follows: faster as the breath comes in, slower as it goes out${
                    patternId === "deep" ? " — most of all when breathing slow and deep like this." : "."
                  }`}
            </p>
          )}
          {lungsHidden && (
            <p className="mt-0.5 text-amber-300/80">
              {fa ? "برای مشاهدهٔ ریه‌ها، دستگاه تنفسی را فعال کنید." : "Switch the respiratory system on to see the lungs fill."}
            </p>
          )}
          <div role="radiogroup" aria-label={fa ? "الگوی تنفس" : "Breathing pattern"} className="mt-1.5 flex gap-1">
            {ORDER.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === patternId}
                onClick={() => setPattern(id)}
                className={`rounded border px-1.5 py-0.5 text-[9px] ${
                  id === patternId
                    ? "border-sky-500 text-sky-200"
                    : "border-slate-700 text-slate-400 hover:border-sky-700 hover:text-sky-200"
                }`}
              >
                {fa ? (id === "quiet" ? "در استراحت" : "عمیق") : id === "quiet" ? "At rest" : "Deep"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

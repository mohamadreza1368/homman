import { useMemo, useState } from "react";

import { useBreathStore } from "@/stores/breathStore";
import { useHeartStore } from "@/stores/heartStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";

import { EcgStrip } from "./EcgStrip";
import { beatChamber } from "./heartbeat";
import { primeHeartSound } from "./heartSound";
import { OVERLAY_SWITCH_OFF, OVERLAY_SWITCH_ON } from "./overlayChrome";
import { RHYTHM_GROUPS, RHYTHMS, rhythm } from "./rhythms";
import { breathNote } from "./sinusArrhythmia";

export function HeartControls() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const enabled = useHeartStore((s) => s.enabled);
  const sound = useHeartStore((s) => s.sound);
  const rhythmId = useHeartStore((s) => s.rhythm);
  const toggle = useHeartStore((s) => s.toggle);
  const setSound = useHeartStore((s) => s.setSound);
  const setRhythm = useHeartStore((s) => s.setRhythm);
  const breathing = useBreathStore((s) => s.enabled);
  const organs = useSceneStore((s) => s.organs);
  const cardiovascularHidden = useSceneStore((s) => s.hiddenSystems.includes("cardiovascular"));
  const vesselsSeeThrough = useSceneStore((s) => (s.systemOpacity.cardiovascular ?? 1) < 1);
  const [rhythmsOpen, setRhythmsOpen] = useState(false);

  const hasHeart = useMemo(
    () => Object.values(organs).some((organ) => beatChamber(organ) !== null),
    [organs],
  );
  const current = rhythm(rhythmId);

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={!hasHeart}
        onClick={() => {
          if (!enabled && sound) primeHeartSound();
          toggle();
        }}
        aria-pressed={enabled}
        title={
          fa
            ? !hasHeart
              ? "این مدل فاقد قلب برای پویانمایی است"
              : enabled
                ? "توقف ضربان قلب"
                : "پویانمایی ضربان قلب"
            : !hasHeart
              ? "This body has no heart to animate"
              : enabled
                ? "Stop the heartbeat"
                : "Make the heart beat: the atria, then the ventricles"
        }
        className={`rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
          enabled ? OVERLAY_SWITCH_ON.rose : OVERLAY_SWITCH_OFF
        }`}
      >
        {fa ? "ضربان قلب" : "Heartbeat"}
      </button>

      {enabled && (
        <div dir={fa ? "rtl" : "ltr"} className="max-w-52 rounded border border-rose-900/60 bg-slate-950/80 px-2 py-1.5 text-[9px] leading-snug text-slate-400">
          <p className="uppercase tracking-wider text-rose-300/80">
            {current.rate} · {fa ? "نمایشی" : "illustrative"}
          </p>
          <p className="mt-0.5 font-medium text-slate-200">{current.label}</p>
          <p className="mt-0.5">{current.what}</p>
          <EcgStrip />
          {breathing && <p className="mt-0.5 text-sky-300/80">{breathNote(current.followsBreath ?? 0)}</p>}
          {cardiovascularHidden && (
            <p className="mt-0.5 text-amber-300/80">
              {fa ? "برای مشاهده، دستگاه قلب و عروق را روشن کنید." : "Switch the cardiovascular system on to see it."}
            </p>
          )}
          <p className="mt-0.5 text-slate-500">
            {fa
              ? vesselsSeeThrough
                ? "قرمز خون اکسیژن‌دار و آبی خون کم‌اکسیژن است."
                : "برای مشاهدهٔ جریان خون در رگ‌ها، حالت بدن شفاف را فعال کنید."
              : vesselsSeeThrough
                ? "Blood: red carries oxygen, blue returns without it. Each pulse leaves with a contraction, slowed to be seen."
                : "Turn on Glass body to watch each beat push the blood."}
          </p>
          <label className="mt-1 flex cursor-pointer items-start gap-1.5">
            <input
              type="checkbox"
              checked={sound}
              onChange={(event) => {
                if (event.target.checked) primeHeartSound();
                setSound(event.target.checked);
              }}
              className="mt-[1px] accent-rose-500"
            />
            {fa ? "صدای قلب" : "Heart sounds"}
          </label>

          <button
            type="button"
            onClick={() => setRhythmsOpen((open) => !open)}
            aria-expanded={rhythmsOpen}
            className="mt-1.5 flex w-full items-center justify-between rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-rose-700 hover:text-rose-200"
          >
            <span>{fa ? "ریتم‌ها و سوفل‌ها" : "Rhythms and murmurs"}</span>
            <span aria-hidden>{rhythmsOpen ? "▴" : "▾"}</span>
          </button>

          {rhythmsOpen && (
            <div
              role="radiogroup"
              aria-label={fa ? "ریتم قلب" : "Heart rhythm"}
              className="mt-1 max-h-48 space-y-1 overflow-y-auto pe-0.5 short:max-h-32"
            >
              {RHYTHM_GROUPS.map((group) => (
                <div key={group}>
                  <p className="text-[8px] uppercase tracking-wider text-slate-500">{group}</p>
                  {RHYTHMS.filter((candidate) => candidate.group === group).map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      role="radio"
                      aria-checked={candidate.id === rhythmId}
                      onClick={() => setRhythm(candidate.id)}
                      className={`block w-full rounded px-1 py-0.5 text-start text-[9px] ${
                        candidate.id === rhythmId
                          ? "bg-rose-500/15 text-rose-200"
                          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                      }`}
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
              ))}
              <p className="pt-1 text-[8px] leading-snug text-slate-500">
                {fa
                  ? "الگوهای آموزشی برای مطالعه و نه ابزار تشخیص بالینی."
                  : "Textbook patterns for study, each at one representative rate — not a way to assess anyone's heart. Murmurs are best heard with headphones."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

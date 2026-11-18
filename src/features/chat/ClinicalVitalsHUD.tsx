import { memo, useMemo } from "react";

import type { CaseFile } from "@/lib/studyDb";
import { useBreathStore } from "@/stores/breathStore";
import { useHeartStore } from "@/stores/heartStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";

export interface ClinicalVitals {
  hr: number;
  bpSystolic: number;
  bpDiastolic: number;
  spo2: number;
  rr: number;
  temp: number;
}

/**
 * Extract quantitative bedside vital signs from patient case findings,
 * falling back to physiological resting standards if omitted in the case note.
 */
export function parseClinicalVitals(findings: string): ClinicalVitals {
  const bpMatch = findings.match(/(?:BP|pressure|فشار|فشار\s*خون)?[:\s]*(\d{2,3})\s*[/\\-]\s*(\d{2,3})/i);
  const hrMatch = findings.match(/(?:HR|pulse|heart\s*rate|ضربان|نبض)[:\s]*(\d{2,3})/i);
  const spo2Match = findings.match(/(?:SpO2|SaO2|O2|sat|اکسیژن)[:\s]*(\d{2,3})\s*%?/i);
  const rrMatch = findings.match(/(?:RR|resp|breaths|تنفس)[:\s]*(\d{1,2})/i);
  const tempMatch = findings.match(/(?:Temp|temperature|دما|تب)[:\s]*(\d{2}(?:\.\d)?)/i);

  return {
    bpSystolic: bpMatch ? Number(bpMatch[1]) : 120,
    bpDiastolic: bpMatch ? Number(bpMatch[2]) : 80,
    hr: hrMatch ? Number(hrMatch[1]) : 74,
    spo2: spo2Match ? Math.min(100, Math.max(50, Number(spo2Match[1]))) : 98,
    rr: rrMatch ? Number(rrMatch[1]) : 16,
    temp: tempMatch ? Number(tempMatch[1]) : 36.8,
  };
}

/**
 * Bedside ICU-style interactive clinical vitals HUD for active virtual patient drills.
 */
export const ClinicalVitalsHUD = memo(function ClinicalVitalsHUD({
  patient,
  compact = false,
}: {
  patient: CaseFile;
  compact?: boolean;
}) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const heartEnabled = useHeartStore((s) => s.enabled);
  const toggleHeart = useHeartStore((s) => s.toggle);
  const breathEnabled = useBreathStore((s) => s.enabled);
  const toggleBreath = useBreathStore((s) => s.toggle);
  const focusReference = useSceneStore((s) => s.focusReference);

  const vitals = useMemo(() => parseClinicalVitals(patient.findings || ""), [patient.findings]);
  const pulseDuration = `${Math.max(0.3, 60 / vitals.hr)}s`;

  const handleHeartClick = () => {
    if (!heartEnabled) {
      toggleHeart();
      focusReference("cor_ventriculus_sinister", 1);
    } else {
      toggleHeart();
    }
  };

  const isHrAlert = vitals.hr > 100 || vitals.hr < 60;
  const isBpAlert = vitals.bpSystolic > 140 || vitals.bpDiastolic > 90 || vitals.bpSystolic < 90;
  const isSpo2Alert = vitals.spo2 < 95;

  if (compact) {
    return (
      <div
        data-testid="clinical-vitals-hud-compact"
        className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-slate-950/70 px-2.5 py-1 text-[10.5px] font-mono shadow-inner backdrop-blur-sm"
      >
        <button
          type="button"
          onClick={handleHeartClick}
          title={fa ? "مشاهده ضربان قلب در صحنه سه‌بعدی" : "Toggle 3D heartbeat"}
          className="flex items-center gap-1 transition hover:opacity-80"
        >
          <span
            className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
            style={{ animation: `pulse ${pulseDuration} cubic-bezier(0.4, 0, 0.6, 1) infinite` }}
          />
          <span className="text-slate-400 font-sans text-[9px]">{fa ? "ضربان:" : "HR:"}</span>
          <span className={`font-semibold ${isHrAlert ? "text-amber-400" : "text-emerald-300"}`}>
            {vitals.hr}
          </span>
          <span className="text-[9px] text-slate-500">bpm</span>
        </button>

        <span className="text-slate-700">|</span>

        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-sans text-[9px]">{fa ? "فشار:" : "BP:"}</span>
          <span className={`font-semibold ${isBpAlert ? "text-amber-400" : "text-sky-300"}`}>
            {vitals.bpSystolic}/{vitals.bpDiastolic}
          </span>
          <span className="text-[9px] text-slate-500">mmHg</span>
        </div>

        <span className="text-slate-700">|</span>

        <div className="flex items-center gap-1">
          <span className="text-slate-400 font-sans text-[9px]">SpO₂:</span>
          <span className={`font-semibold ${isSpo2Alert ? "text-rose-400" : "text-cyan-300"}`}>
            {vitals.spo2}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="clinical-vitals-hud"
      className="my-1.5 overflow-hidden rounded-xl border border-emerald-500/30 bg-slate-950/90 p-2.5 shadow-2xl backdrop-blur-md"
    >
      <div className="mb-2 flex items-center justify-between border-b border-slate-800/80 pb-1.5 text-[10px]">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]"
            style={{ animation: `pulse ${pulseDuration} cubic-bezier(0.4, 0, 0.6, 1) infinite` }}
          />
          <span className="font-semibold uppercase tracking-wider text-emerald-400">
            {fa ? "مانیتور علائم حیاتی بیمار" : "Bedside Clinical Monitor"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
          <span>{fa ? "سیستم شبیه‌سازی:" : "SIM:"}</span>
          <span className={heartEnabled ? "text-emerald-400" : "text-slate-600"}>
            {fa ? (heartEnabled ? "قلب فعال" : "قلب آماده") : (heartEnabled ? "HR ON" : "HR IDLE")}
          </span>
          <span>·</span>
          <span className={breathEnabled ? "text-teal-400" : "text-slate-600"}>
            {fa ? (breathEnabled ? "تنفس فعال" : "تنفس آماده") : (breathEnabled ? "RESP ON" : "RESP IDLE")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 text-center font-mono">
        {/* Heart Rate */}
        <button
          type="button"
          onClick={handleHeartClick}
          title={fa ? "فعال‌سازی ضربان قلب در اطلس سه‌بعدی" : "Toggle 3D heartbeat simulation"}
          className="group flex flex-col items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-1.5 transition hover:border-emerald-400/50 hover:bg-emerald-900/30"
        >
          <span className="text-[9px] font-sans font-medium uppercase text-emerald-400 group-hover:text-emerald-300">
            {fa ? "ضربان (HR)" : "HR (bpm)"}
          </span>
          <span className={`text-base font-bold tracking-tight ${isHrAlert ? "text-amber-400" : "text-emerald-300"}`}>
            {vitals.hr}
          </span>
          <span className="text-[8.5px] text-emerald-600 font-sans">
            {heartEnabled ? (fa ? "در حال تپش" : "Beating") : (fa ? "کلیک برای رندر" : "Click to view")}
          </span>
        </button>

        {/* Blood Pressure */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-sky-500/20 bg-sky-950/20 p-1.5">
          <span className="text-[9px] font-sans font-medium uppercase text-sky-400">
            {fa ? "فشار خون" : "NIBP (mmHg)"}
          </span>
          <span className={`text-base font-bold tracking-tight ${isBpAlert ? "text-amber-400" : "text-sky-300"}`}>
            {vitals.bpSystolic}/{vitals.bpDiastolic}
          </span>
          <span className="text-[8.5px] text-sky-600 font-sans">
            {fa ? "سیستول/دیاستول" : "Sys / Dia"}
          </span>
        </div>

        {/* SpO2 */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-1.5">
          <span className="text-[9px] font-sans font-medium uppercase text-cyan-400">
            {fa ? "اشباع O₂" : "SpO₂ (%)"}
          </span>
          <span className={`text-base font-bold tracking-tight ${isSpo2Alert ? "text-rose-400" : "text-cyan-300"}`}>
            {vitals.spo2}%
          </span>
          <span className="text-[8.5px] text-cyan-600 font-sans">
            {vitals.spo2 >= 95 ? (fa ? "طبیعی" : "Normal") : (fa ? "هیپوکسی" : "Hypoxia")}
          </span>
        </div>

        {/* Respiratory Rate */}
        <button
          type="button"
          onClick={toggleBreath}
          title={fa ? "فعال‌سازی شبیه‌سازی تنفس ریه‌ها" : "Toggle 3D breathing simulation"}
          className="group flex flex-col items-center justify-center rounded-lg border border-teal-500/20 bg-teal-950/20 p-1.5 transition hover:border-teal-400/50 hover:bg-teal-900/30"
        >
          <span className="text-[9px] font-sans font-medium uppercase text-teal-400 group-hover:text-teal-300">
            {fa ? "تعداد تنفس" : "RR (/min)"}
          </span>
          <span className="text-base font-bold tracking-tight text-teal-300">
            {vitals.rr}
          </span>
          <span className="text-[8.5px] text-teal-600 font-sans">
            {breathEnabled ? (fa ? "تنفس فعال" : "Active") : (fa ? "کلیک برای انیمیشن" : "Click to view")}
          </span>
        </button>

        {/* Core Temperature */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-amber-500/20 bg-amber-950/20 p-1.5">
          <span className="text-[9px] font-sans font-medium uppercase text-amber-400">
            {fa ? "دمای بدن" : "Temp (°C)"}
          </span>
          <span className={`text-base font-bold tracking-tight ${vitals.temp > 37.8 ? "text-rose-400" : "text-amber-300"}`}>
            {vitals.temp.toFixed(1)}°
          </span>
          <span className="text-[8.5px] text-amber-600 font-sans">
            {vitals.temp > 37.8 ? (fa ? "تب" : "Fever") : (fa ? "نرمال" : "Normotherm")}
          </span>
        </div>
      </div>
    </div>
  );
});

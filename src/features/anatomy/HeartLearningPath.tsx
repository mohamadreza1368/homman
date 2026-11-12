import { useState } from "react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { anatomyConcepts } from "./concepts";
import { HEART_QUESTIONS, HeartLessonQuiz } from "./HeartLessonQuiz";
import { emptyHeartProgress, HEART_PROGRESS_KEY, parseHeartProgress, type HeartProgress } from "./heartProgress";

export const HEART_PATH = ["homman:right-atrium", "homman:right-ventricle", "homman:pulmonary-trunk", "homman:left-atrium", "homman:left-ventricle", "homman:ascending-aorta"] as const;

function readProgress(): HeartProgress {
  try { return parseHeartProgress(JSON.parse(localStorage.getItem(HEART_PROGRESS_KEY) ?? "null"), HEART_PATH.length, HEART_QUESTIONS.length); }
  catch { return emptyHeartProgress(); }
}

export function HeartLearningPath() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const model = useSceneStore((s) => s.genderModel);
  const organs = useSceneStore((s) => s.organs);
  const apply = useSceneStore((s) => s.applyCommand);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<HeartProgress>(readProgress);
  const [storageFailed, setStorageFailed] = useState(false);
  const [step, setStep] = useState(() => progress.lastStep);
  const [quiz, setQuiz] = useState(false);
  const concept = anatomyConcepts.find((entry) => entry.id === HEART_PATH[step]);
  if (!concept) return null;
  const organId = concept.models[model].find((id) => !!organs[id]);
  function save(next: HeartProgress) {
    setProgress(next);
    try { localStorage.setItem(HEART_PROGRESS_KEY, JSON.stringify(next)); setStorageFailed(false); }
    catch { setStorageFailed(true); }
  }
  function visit(index: number) {
    setStep(index);
    save({ ...progress, lastStep: index, visited: [...new Set([...progress.visited, index])] });
  }
  return <section aria-label={fa ? "مسیر آموزشی قلب" : "Heart learning path"} className="rounded-2xl border border-teal-700/40 bg-slate-900 p-4">
    <p className="text-[10px] font-semibold tracking-wide text-teal-300">{fa ? "مسیر یادگیری" : "LEARNING PATH"}</p>
    <h2 className="mt-1 text-sm font-semibold text-white">{fa ? "مسیر خون در قلب" : "Blood flow through the heart"}</h2>
    <p className="mt-2 text-xs leading-6 text-slate-400">{fa ? "شش گام برای شناخت حفره‌ها و رگ‌های اصلی؛ محتوای آموزشی نیازمند بازبینی تخصصی است." : "Six steps through the chambers and major vessels; educational content requires specialist review."}</p>
    <p className="mt-2 text-xs text-slate-400">{fa ? `${progress.visited.length} از ${HEART_PATH.length} گام دیده‌شده${progress.last !== null ? ` · آخرین آزمون: ${progress.last} از ${HEART_QUESTIONS.length}` : ""}` : `${progress.visited.length} of ${HEART_PATH.length} steps viewed${progress.last !== null ? ` · Last quiz: ${progress.last} of ${HEART_QUESTIONS.length}` : ""}`}</p>
    {storageFailed && <p role="status" className="mt-1 text-xs text-amber-200">{fa ? "ذخیره‌سازی در دسترس نیست؛ پیشرفت فقط در این نشست می‌ماند." : "Storage unavailable; progress is session-only."}</p>}
    {!open && <button type="button" onClick={() => { setOpen(true); visit(step); }} className="mt-3 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600">{progress.visited.length ? (fa ? "ادامهٔ مسیر" : "Resume path") : (fa ? "شروع مسیر" : "Start path")}</button>}
    {open && quiz && <div className="mt-3"><HeartLessonQuiz fa={fa} onClose={() => setQuiz(false)} onComplete={(score) => save({ ...progress, attempts: progress.attempts + 1, last: score, best: Math.max(progress.best ?? 0, score) })} /></div>}
    {open && !quiz && <div className="mt-3 space-y-3 text-xs leading-6 text-slate-200">
      <p className="text-teal-300">{fa ? `گام ${step + 1} از ${HEART_PATH.length}` : `Step ${step + 1} of ${HEART_PATH.length}`}</p>
      <h3 className="text-sm font-semibold text-white">{fa ? concept.name.fa : concept.name.en}</h3>
      <p>{fa ? concept.description.fa : concept.description.en}</p>
      {step === 2 && <p className="text-slate-300">{fa ? "خون در ریه‌ها اکسیژن می‌گیرد و از راه وریدهای ریوی به دهلیز چپ برمی‌گردد." : "Blood receives oxygen in the lungs and returns through pulmonary veins to the left atrium."}</p>}
      {organId ? <button type="button" onClick={() => {
        const organ = organs[organId]!;
        apply({ action: "set_layer_visibility", system: organ.system, visible: true });
        apply({ action: "focus_organ", organ_id: organId });
      }} className="rounded-lg bg-teal-800 px-3 py-2 text-white hover:bg-teal-700">{fa ? "نمایش روی مدل" : "Show on model"}</button> : <p className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-2 text-amber-200">{fa ? "برای این ساختار در مدل انتخاب‌شده معادل ثبت نشده است؛ متن آموزشی همچنان در دسترس است." : "No mapping is recorded for this structure in the selected model; the lesson remains available."}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={step === 0} onClick={() => visit(step - 1)} className="rounded-lg border border-slate-600 px-3 py-1 disabled:opacity-40">{fa ? "قبلی" : "Previous"}</button>
        <button type="button" disabled={step === HEART_PATH.length - 1} onClick={() => visit(step + 1)} className="rounded-lg border border-slate-600 px-3 py-1 disabled:opacity-40">{fa ? "بعدی" : "Next"}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1 text-slate-400 underline">{fa ? "بستن مسیر" : "Close path"}</button>
      </div>
      {step === HEART_PATH.length - 1 && <button type="button" onClick={() => setQuiz(true)} className="rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white hover:bg-teal-600">{fa ? "شروع آزمون مسیر" : "Start lesson quiz"}</button>}
      <a href={concept.source} target="_blank" rel="noreferrer" className="inline-block text-teal-300 underline">{fa ? "منبع: مؤسسهٔ ملی قلب، ریه و خون" : "Source: National Heart, Lung, and Blood Institute"}</a>
    </div>}
  </section>;
}

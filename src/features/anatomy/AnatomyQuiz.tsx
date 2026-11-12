import { useEffect, useState } from "react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { anatomyConcepts } from "./concepts";
import { nextReview, parseReviewRecords, recordAnswer, type ReviewRecords } from "./reviewSchedule";

const STORAGE_KEY = "homman.anatomy-practice.v1";
function readProgress(): ReviewRecords {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parseReviewRecords(value);
  } catch { return {}; }
}

export function AnatomyQuiz({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const model = useSceneStore((s) => s.genderModel);
  const organs = useSceneStore((s) => s.organs);
  const selected = useSceneStore((s) => s.selectedOrganIds);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const apply = useSceneStore((s) => s.applyCommand);
  const [progress, setProgress] = useState<ReviewRecords>(readProgress);
  const [storageFailed, setStorageFailed] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [now, setNow] = useState(Date.now);
  const available = anatomyConcepts.filter((c) => c.models[model].some((id) => !!organs[id]));
  const nextId = nextReview(available.map((c) => c.id), progress, now);
  const target = available.find((c) => c.id === (active ? targetId : nextId));

  useEffect(() => { setActive(false); setAnswered(null); onActiveChange(false); }, [model, onActiveChange]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  function start() {
    if (!target) return;
    setTargetId(target.id);
    clearSelection();
    setAnswered(null);
    setActive(true);
    onActiveChange(true);
    for (const id of target.models[model]) {
      if (organs[id]) apply({ action: "set_layer_visibility", system: organs[id].system, visible: true });
    }
  }

  function submit() {
    if (!target || !selected.length || answered !== null) return;
    const correct = selected.some((id) => target.models[model].includes(id));
    setAnswered(correct);
    onActiveChange(false);
    const answeredAt = Date.now();
    setNow(answeredAt);
    const next = { ...progress, [target.id]: recordAnswer(progress[target.id], correct, answeredAt) };
    setProgress(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageFailed(false); } catch { setStorageFailed(true); }
  }

  function next() {
    setActive(false);
    setAnswered(null);
    setTargetId(null);
  }

  const attempts = Object.values(progress).reduce((sum, item) => sum + item.attempts, 0);
  const correct = Object.values(progress).reduce((sum, item) => sum + item.correct, 0);
  const due = available.filter((c) => progress[c.id] && progress[c.id]!.dueAt <= now).length;
  const upcoming = available.map((c) => progress[c.id]?.dueAt).filter((t): t is number => t !== undefined && t > now).sort((a, b) => a - b)[0];
  return <section className="rounded-2xl border border-teal-700/50 bg-slate-900 p-4" aria-label={fa ? "تمرین آناتومی" : "Anatomy practice"}>
    <p className="text-[10px] font-semibold tracking-wide text-teal-300">{fa ? "یادگیری فعال" : "ACTIVE LEARNING"}</p>
    <h2 className="mt-1 text-sm font-semibold text-white">{fa ? "ساختار را پیدا کن" : "Find the structure"}</h2>
    <p className="mt-2 text-xs leading-6 text-slate-400">{fa ? `${correct} پاسخ درست از ${attempts} تلاش · ${storageFailed ? "ذخیره‌سازی در دسترس نیست؛ پیشرفت فقط در این نشست می‌ماند." : "پیشرفت در این دستگاه ذخیره می‌شود."}` : `${correct} correct of ${attempts} attempts · ${storageFailed ? "Storage unavailable; progress is session-only." : "Progress is stored on this device."}`}</p>
    <p className="mt-1 text-xs leading-6 text-teal-200">{fa ? `${due} مورد آمادهٔ مرور${upcoming && !due ? ` · مرور بعدی: ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(upcoming)}` : ""}` : `${due} due for review${upcoming && !due ? ` · Next review: ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(upcoming)}` : ""}`}</p>
    {!target && <p className="mt-2 text-xs text-amber-200">{fa ? "برای این مدل هنوز ساختاری برای تمرین ثبت نشده است." : "No practice structures are available for this model yet."}</p>}
    {target && !active && <button type="button" onClick={start} className="mt-3 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600 focus-visible:outline-2 focus-visible:outline-teal-300">{fa ? "شروع تمرین" : "Start practice"}</button>}
    {active && target && <div className="mt-3 space-y-3 text-xs leading-6 text-slate-200">
      <p>{fa ? `«${target.name.fa}» را روی مدل یا در فهرست انتخاب کن.` : `Select “${target.name.en}” on the model or in the list.`}</p>
      {answered === null ? <button type="button" onClick={submit} disabled={!selected.length} className="rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white hover:bg-teal-600 disabled:opacity-40">{fa ? "بررسی پاسخ" : "Check answer"}</button> : <>
        <p role="status" className={answered ? "text-teal-200" : "text-amber-200"}>{answered ? (fa ? "درست است." : "Correct.") : (fa ? `این پاسخ درست نیست؛ ساختار مورد نظر ${target.name.fa} است.` : `Not quite; the target is ${target.name.en}.`)}</p>
        <p>{fa ? target.description.fa : target.description.en}</p>
        <a className="inline-block text-teal-300 underline" href={target.source} target="_blank" rel="noreferrer">{fa ? "منبع" : "Source"}</a>
        <button type="button" onClick={next} className="block rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white">{fa ? "تمرین بعدی" : "Next question"}</button>
      </>}
      <button type="button" onClick={() => { setActive(false); setAnswered(null); onActiveChange(false); }} className="block text-slate-400 underline">{fa ? "پایان تمرین" : "End practice"}</button>
    </div>}
  </section>;
}

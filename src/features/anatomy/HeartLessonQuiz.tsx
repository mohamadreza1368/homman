import { useState } from "react";

type Localized = { fa: string; en: string };
interface Question { question: Localized; answers: Localized[]; correct: number; explanation: Localized }
export const HEART_QUESTIONS: Question[] = [
  { question: { fa: "خون بازگشته از بدن ابتدا وارد کدام حفرهٔ قلب می‌شود؟", en: "Which chamber first receives blood returning from the body?" }, answers: [{ fa: "دهلیز راست", en: "Right atrium" }, { fa: "دهلیز چپ", en: "Left atrium" }, { fa: "بطن چپ", en: "Left ventricle" }], correct: 0, explanation: { fa: "خون بازگشته از بدن از راه وریدهای اجوف وارد دهلیز راست می‌شود.", en: "Blood returning from the body enters the right atrium via the venae cavae." } },
  { question: { fa: "کدام حفره خون را به سمت ریه‌ها پمپ می‌کند؟", en: "Which chamber pumps blood toward the lungs?" }, answers: [{ fa: "بطن چپ", en: "Left ventricle" }, { fa: "بطن راست", en: "Right ventricle" }, { fa: "دهلیز چپ", en: "Left atrium" }], correct: 1, explanation: { fa: "بطن راست خون را به مسیر عروق ریوی و ریه‌ها پمپ می‌کند.", en: "The right ventricle pumps blood toward the lungs through the pulmonary circulation." } },
  { question: { fa: "خون پس از دریافت اکسیژن در ریه‌ها ابتدا به کدام حفره برمی‌گردد؟", en: "After receiving oxygen in the lungs, which chamber does blood return to first?" }, answers: [{ fa: "دهلیز چپ", en: "Left atrium" }, { fa: "بطن راست", en: "Right ventricle" }, { fa: "دهلیز راست", en: "Right atrium" }], correct: 0, explanation: { fa: "خون از طریق وریدهای ریوی به دهلیز چپ بازمی‌گردد.", en: "Blood returns to the left atrium through the pulmonary veins." } },
  { question: { fa: "خون خروجی از بطن چپ از کدام رگ اصلی به بدن می‌رسد؟", en: "Which major vessel carries blood from the left ventricle toward the body?" }, answers: [{ fa: "ورید اجوف", en: "Vena cava" }, { fa: "آئورت", en: "Aorta" }, { fa: "ورید ریوی", en: "Pulmonary vein" }], correct: 1, explanation: { fa: "بطن چپ خون را به آئورت پمپ می‌کند و خون از آنجا به گردش بدن می‌رود.", en: "The left ventricle pumps blood into the aorta for systemic circulation." } },
];

export function HeartLessonQuiz({ fa, onClose, onComplete }: { fa: boolean; onClose: () => void; onComplete?: (score: number) => void }) {
  const [question, setQuestion] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const current = HEART_QUESTIONS[question]!;
  const lang = fa ? "fa" : "en";

  function check() {
    if (choice === null || checked) return;
    if (choice === current.correct) setScore((n) => n + 1);
    setChecked(true);
  }
  function advance() {
    if (question === HEART_QUESTIONS.length - 1) { setFinished(true); onComplete?.(score); return; }
    setQuestion((n) => n + 1); setChoice(null); setChecked(false);
  }
  function restart() { setQuestion(0); setChoice(null); setChecked(false); setScore(0); setFinished(false); }

  return <div className="space-y-3 rounded-xl border border-teal-700/40 bg-slate-950/70 p-3 text-xs leading-6" aria-label={fa ? "آزمون گردش خون" : "Blood flow quiz"}>
    {finished ? <div role="status"><p className="font-semibold text-teal-200">{fa ? `پایان تمرین: ${score} پاسخ درست از ${HEART_QUESTIONS.length}` : `Practice complete: ${score} of ${HEART_QUESTIONS.length} correct`}</p><p className="text-slate-400">{fa ? "می‌توانید مسیر را دوباره بخوانید یا آزمون را تکرار کنید." : "Review the lesson or try the quiz again."}</p><button type="button" onClick={restart} className="mt-2 rounded-lg bg-teal-800 px-3 py-1 text-white">{fa ? "تکرار آزمون" : "Try again"}</button></div> : <>
      <p className="text-teal-300">{fa ? `پرسش ${question + 1} از ${HEART_QUESTIONS.length}` : `Question ${question + 1} of ${HEART_QUESTIONS.length}`}</p>
      <fieldset><legend className="font-semibold text-white">{current.question[lang]}</legend>
        <div className="mt-2 space-y-1">{current.answers.map((answer, index) => <label key={index} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-slate-200 hover:bg-slate-800"><input type="radio" name={`heart-question-${question}`} checked={choice === index} disabled={checked} onChange={() => setChoice(index)} className="accent-teal-400" />{answer[lang]}</label>)}</div>
      </fieldset>
      {!checked ? <button type="button" disabled={choice === null} onClick={check} className="rounded-lg bg-teal-700 px-3 py-1 text-white disabled:opacity-40">{fa ? "بررسی پاسخ" : "Check answer"}</button> : <div role="status"><p className={choice === current.correct ? "text-teal-200" : "text-amber-200"}>{choice === current.correct ? (fa ? "درست است." : "Correct.") : (fa ? "این پاسخ درست نیست." : "Not quite.")}</p><p className="text-slate-300">{current.explanation[lang]}</p><button type="button" onClick={advance} className="mt-2 rounded-lg bg-teal-700 px-3 py-1 text-white">{question === HEART_QUESTIONS.length - 1 ? (fa ? "مشاهدهٔ نتیجه" : "See result") : (fa ? "پرسش بعدی" : "Next question")}</button></div>}
    </>}
    <button type="button" onClick={onClose} className="block text-slate-400 underline">{fa ? "بازگشت به مسیر" : "Return to lesson"}</button>
  </div>;
}

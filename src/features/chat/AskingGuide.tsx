import { useEffect, useRef, useState } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

interface Point {
  title: string;
  body: string;
  titleFa: string;
  bodyFa: string;
}

const POINTS: Point[] = [
  {
    title: "Point first",
    titleFa: "ابتدا ساختار را انتخاب کنید",
    body:
      "Click a structure, then ask. The assistant is told exactly what you " +
      "selected and treats it as the subject of your question, so it answers " +
      "instead of searching for what you meant.",
    bodyFa:
      "روی یک عضو یا ساختار کلیک کنید و سپس سؤال بپرسید تا دستیار دقیقاً دربارهٔ همان بخش توضیح دهد.",
  },
  {
    title: "Two or more means compare",
    titleFa: "انتخاب چند ساختار برای مقایسه",
    body:
      "Ctrl-click several and the assistant is told to address the set. " +
      "Select the thalamus and the hypothalamus and ask how they differ.",
    bodyFa:
      "با نگه داشتن Ctrl چند ساختار را انتخاب کنید و تفاوت یا ارتباط بین آن‌ها را بپرسید.",
  },
  {
    title: "A region sets the scope",
    titleFa: "محدودکردن ناحیه",
    body:
      "Isolate a group — the brainstem, the kidney, a body region — and the " +
      "question is understood to be about that, not about the whole body.",
    bodyFa:
      "با ایزوله‌کردن یک گروه یا ناحیه، پرسش‌های شما روی همان محدوده متمرکز می‌شوند.",
  },
  {
    title: "Specific beats broad",
    titleFa: "سؤال دقیق‌تر، پاسخ بهتر",
    body:
      "“What does this do?” with something selected gets a better answer than " +
      "“explain the brain” with nothing, and costs less.",
    bodyFa:
      "پرسیدن دربارهٔ یک ساختار انتخاب‌شده دقیق‌تر، سریع‌تر و کم‌مصرف‌تر از سؤالات کلی است.",
  },
];

export function AskingGuide() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="rounded border border-slate-700/70 px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:border-slate-600 hover:text-slate-300"
      >
        {fa ? "راهنمای پرسش" : "How to ask"}
      </button>

      {open && (
        <div
          dir={fa ? "rtl" : "ltr"}
          role="dialog"
          aria-label={fa ? "راهنمای پرسش" : "How to ask"}
          className="absolute bottom-full right-0 z-20 mb-1.5 w-[17rem] rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl"
        >
          <p className="mb-2 text-[11px] font-semibold text-slate-200">
            {fa ? "نکات دریافت پاسخ بهتر" : "Getting a good answer"}
          </p>
          <ul className="space-y-2">
            {POINTS.map((point) => (
              <li key={point.title} className="text-[11px] leading-snug text-slate-400">
                <span className="font-medium text-slate-300">
                  {fa ? point.titleFa : point.title}.
                </span>{" "}
                {fa ? point.bodyFa : point.body}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 border-t border-slate-800 pt-2 text-[10px] leading-snug text-slate-500">
            {fa
              ? "حداکثر ۸۰۰۰ کاراکتر در هر سؤال و ۶۴ ساختار انتخابی."
              : "Up to 8,000 characters per question and 64 selected structures."}
          </p>
        </div>
      )}
    </div>
  );
}

export function AimHint({ onDismiss }: { onDismiss: () => void }) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  return (
    <p
      dir={fa ? "rtl" : "ltr"}
      className="mx-3 mb-2 flex items-start gap-2 rounded border border-sky-800/50 bg-sky-900/15 px-2 py-1 text-[10px] leading-snug text-slate-400"
    >
      <span className="flex-1">
        <span className="font-medium text-sky-300">
          {fa ? "ساختاری انتخاب نشده است." : "Nothing is selected."}
        </span>{" "}
        {fa
          ? "ابتدا روی یک ساختار در نمای سه‌بعدی کلیک کنید تا دستیار دقیقاً دربارهٔ همان بخش پاسخ دهد."
          : "Click a structure in the viewport first and the assistant is told what you mean — it answers that, instead of searching the atlas for it."}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={fa ? "دیگر نمایش نده" : "Do not show this again"}
        className="shrink-0 rounded px-1 text-slate-500 transition hover:text-slate-200"
      >
        ×
      </button>
    </p>
  );
}

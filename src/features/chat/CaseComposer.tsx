import { useState } from "react";
import { GrowingTextarea } from "@/components/GrowingTextarea";
import type { Language, UserProfile } from "@/lib/schemas";
import type { CaseSex } from "@/lib/studyDb";
import { useCaseStore } from "@/stores/caseStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

export interface CaseComposerProps {
  profile: UserProfile;
  language: Language;
  onClose: () => void;
}

export function CaseComposer({ profile, language, onClose }: CaseComposerProps) {
  const createCase = useCaseStore((state) => state.open);
  const storeError = useCaseStore((state) => state.error);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const [title, setTitle] = useState("");
  const [sex, setSex] = useState<CaseSex>("female");
  const [ageYears, setAgeYears] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [findingsText, setFindingsText] = useState("");
  const [groundTruthAnswer, setGroundTruthAnswer] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const canSubmit = title.trim().length > 0 && groundTruthAnswer.trim().length > 0;

  function parseNumberOrNull(val: string): number | null {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }

  async function handleSeal() {
    setIsBusy(true);
    try {
      const created = await createCase({
        id: crypto.randomUUID(),
        title: title.trim(),
        sex,
        age_years: parseNumberOrNull(ageYears),
        height_cm: parseNumberOrNull(heightCm),
        findings: findingsText.trim(),
        weight_kg: parseNumberOrNull(weightKg),
        ground_truth: groundTruthAnswer.trim(),
        profile,
        language,
      });
      if (created) onClose();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-b border-slate-800 px-3 py-2 text-[10px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wider text-slate-500">
          {isPersian ? "بیمار فرضی جدید" : "New virtual patient"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1 text-slate-500 transition hover:text-slate-200"
        >
          {isPersian ? "انصراف" : "cancel"}
        </button>
      </div>

      <p className="leading-snug text-amber-300/80">
        {isPersian
          ? "طراحی‌شده برای آموزش — هرگز مشخصات یک فرد واقعی را وارد نکنید. این پرونده در هر نوبت به هوش مصنوعی شما ارسال می‌شود."
          : "Invented for teaching — never a real person. The case is sent to your AI provider with every turn of the drill."}
      </p>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          isPersian
            ? "موضوع پرونده — مثلاً درد قفسه سینه، ۵۸ ساله"
            : "What the case is about — e.g. Chest pain, 58"
        }
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 outline-none placeholder:text-slate-600 focus:border-sky-600"
      />

      <div className="flex items-center gap-1.5">
        <div className="flex overflow-hidden rounded border border-slate-700">
          {(["female", "male"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSex(opt)}
              aria-pressed={sex === opt}
              className={`px-2 py-0.5 transition ${
                sex === opt
                  ? "bg-slate-700/70 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {opt === "female" ? (isPersian ? "زن" : "Female") : isPersian ? "مرد" : "Male"}
            </button>
          ))}
        </div>
        <input
          value={ageYears}
          onChange={(e) => setAgeYears(e.target.value)}
          inputMode="numeric"
          placeholder={isPersian ? "سن" : "Age"}
          className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 outline-none placeholder:text-slate-600 focus:border-sky-600"
        />
        <input
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          inputMode="numeric"
          placeholder={isPersian ? "قد (cm)" : "cm"}
          className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 outline-none placeholder:text-slate-600 focus:border-sky-600"
        />
        <input
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          inputMode="decimal"
          placeholder={isPersian ? "وزن (kg)" : "kg"}
          className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 outline-none placeholder:text-slate-600 focus:border-sky-600"
        />
      </div>

      <p className="leading-snug text-slate-600">
        {isPersian
          ? "جنسیت بر استدلال تأثیر دارد. مدل سه‌بعدی در این نسخه فارغ از انتخاب شما ساختار پایه را نشان می‌دهد."
          : "Sex drives the reasoning. The 3D model in this build is male whichever you choose."}
      </p>

      <GrowingTextarea
        limit="24vh"
        value={findingsText}
        onChange={(e) => setFindingsText(e.target.value)}
        rows={2}
        placeholder={
          isPersian
            ? "آنچه در پرونده موجود است — علائم حیاتی، سابقه، آزمایش‌ها. کاربر این را می‌بیند."
            : "What is on the record — vitals, history, results. The reader sees this."
        }
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 leading-relaxed outline-none placeholder:text-slate-600 focus:border-sky-600"
      />

      <GrowingTextarea
        limit="24vh"
        value={groundTruthAnswer}
        onChange={(e) => setGroundTruthAnswer(e.target.value)}
        rows={3}
        placeholder={
          isPersian
            ? "علت و تشخیص واقعی. اکنون مهروموم شده و در زمان درخواست آشکار می‌شود."
            : "What is actually going on. Sealed now, revealed when you ask."
        }
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 leading-relaxed outline-none placeholder:text-slate-600 focus:border-sky-600"
      />

      <p className="leading-snug text-slate-600">
        {isPersian
          ? "قبل از هر تلاشی نوشته می‌شود و پس از آن غیرقابل ویرایش است — پاسخی که بعد از تلاش تعیین شود ارزش ارزیابی ندارد."
          : "Written before anything is attempted, and never editable afterwards — an answer decided once the attempt is in hand grades nothing."}
      </p>

      {storeError && <p className="leading-snug text-rose-400">{storeError}</p>}

      <button
        type="button"
        onClick={() => void handleSeal()}
        disabled={!canSubmit || isBusy}
        className="w-full rounded border border-sky-700/60 bg-sky-600/15 px-2 py-1 text-sky-200 transition hover:bg-sky-600/25 disabled:opacity-40"
      >
        {isPersian ? "مهروموم و شروع پرونده" : "Seal and open"}
      </button>
    </div>
  );
}

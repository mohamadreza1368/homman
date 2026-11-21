import { memo } from "react";
import type { Language, UserProfile } from "@/lib/schemas";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

const PROFILES: { id: UserProfile; label: string; labelFa: string }[] = [
  { id: "layperson", label: "General", labelFa: "عمومی" },
  { id: "student", label: "Student", labelFa: "دانشجو" },
  { id: "clinician", label: "Professional", labelFa: "حرفه‌ای" },
];

const LANGUAGES: { id: Language; label: string; labelFa: string; title: string }[] = [
  {
    id: "auto",
    label: "Auto",
    labelFa: "خودکار (هم‌زبان پیام)",
    title: "پاسخ به همان زبانی که پیام می‌نویسید",
  },
  { id: "en", label: "EN", labelFa: "انگلیسی", title: "Always answer in English" },
];

interface ProfileLanguageControlsProps {
  profile: UserProfile;
  onProfileChange: (p: UserProfile) => void;
  language: Language;
  onLanguageChange: (l: Language) => void;
}

export const ProfileLanguageControls = memo(function ProfileLanguageControls({
  profile,
  onProfileChange,
  language,
  onLanguageChange,
}: ProfileLanguageControlsProps) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");

  return (
    <>
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          {fa ? "سطح مخاطب" : "Audience"}
        </p>
        <div className="flex gap-1">
          {PROFILES.map(({ id, label, labelFa }) => (
            <button
              key={id}
              type="button"
              onClick={() => onProfileChange(id)}
              className={`flex-1 rounded border px-1.5 py-1 text-[11px] ${
                profile === id
                  ? "border-sky-500 bg-sky-500/10 text-sky-300"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              {fa ? labelFa : label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          {fa ? "زبان پاسخ دستیار" : "Answer language"}
        </p>
        <div className="flex gap-1">
          {LANGUAGES.map(({ id, label, labelFa, title }) => (
            <button
              key={id}
              type="button"
              onClick={() => onLanguageChange(id)}
              title={title}
              aria-pressed={language === id}
              className={`flex-1 rounded border px-1.5 py-1 text-[11px] ${
                language === id
                  ? "border-sky-500 bg-sky-500/10 text-sky-300"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              {fa ? labelFa : label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] leading-snug text-slate-600">
          {fa
            ? "در حالت خودکار، اگر به فارسی سؤال بپرسید دستیار به فارسی پاسخ می‌دهد."
            : "In Auto mode, the assistant answers in whatever language you write in."}
        </p>
      </div>
    </>
  );
});

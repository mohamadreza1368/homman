import type { AnatomicalSystem, SessionMode } from "@/lib/schemas";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { CLINICAL_DRILL_PROMPTS } from "./ClinicalDrillPrompts";
import { ReviewIntro } from "./ReviewIntro";

export const AI_GENERATION_DISCLOSURE =
  "You are talking to an AI model. It can be wrong — check anything that matters.";

export interface ChatEmptyStateProps {
  mode: SessionMode;
  chatReady: boolean;
  visibleStructuresCount: number;
  activeSystemsSet: Set<AnatomicalSystem>;
  onSendQuery: (query: string) => void;
}

export function ChatEmptyState({
  mode,
  chatReady,
  visibleStructuresCount,
  activeSystemsSet,
  onSendQuery,
}: ChatEmptyStateProps) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  if (mode === "tutor") {
    return (
      <div className="space-y-2 pt-6 text-center text-xs text-slate-500">
        <p>{isPersian ? "دربارهٔ هر ساختاری در نمای سه‌بعدی سؤال کنید." : "Ask about any structure in the viewport."}</p>
        {!chatReady && (
          <p className="text-[11px] text-amber-300/90">
            {isPersian
              ? "برای شروع گفتگو، آدرس Custom API و نام مدل را در بخش تنظیمات بالا وارد کنید."
              : "Enter your Custom API Base URL and model in Settings above to start chatting."}
          </p>
        )}
        <p className="text-slate-600">
          {isPersian ? "دستیار هنگام توضیح، دوربین را حرکت می‌دهد." : "The assistant moves the camera as it explains."}
        </p>
        <p className="text-[10px] text-slate-600">
          {isPersian ? "با یک مدل هوش مصنوعی گفتگو می‌کنید؛ پاسخ‌ها ممکن است اشتباه باشند." : AI_GENERATION_DISCLOSURE}
        </p>
        <p className="text-[10px] text-slate-700">
          {isPersian
            ? `${visibleStructuresCount} ساختار بارگذاری شده؛ دستگاه‌های دیگر را از پنل اطلس فعال کنید.`
            : `${visibleStructuresCount} structures loaded — switch on more systems in the left panel`}
        </p>
      </div>
    );
  }

  if (mode === "case") {
    return (
      <div className="space-y-3 pt-6 text-center text-xs text-slate-500">
        <p>{isPersian ? "یک سناریوی تمرینی انتخاب کنید یا خودتان بنویسید." : "Pick a scenario, or describe one yourself."}</p>
        <p className="text-slate-600">
          {isPersian
            ? "یک بیمار شبیه‌سازی‌شده و سؤال تمرینی دریافت می‌کنید و پاسخ شما برای مطالعهٔ شخصی نمره‌گذاری و ذخیره می‌شود."
            : "You will get an invented patient, the anatomy marked on the model, and a question to answer. Your answer gets a score for your own study — not a formal assessment — and is kept."}
        </p>
        <p className="text-[10px] text-slate-600">
          {isPersian ? "با یک مدل هوش مصنوعی گفتگو می‌کنید؛ پاسخ‌ها ممکن است خطا داشته باشند." : AI_GENERATION_DISCLOSURE}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          {CLINICAL_DRILL_PROMPTS.filter((item) => activeSystemsSet.has(item.system)).map(
            (starter) => (
              <button
                key={starter.label}
                type="button"
                disabled={!chatReady}
                onClick={() => void onSendQuery(isPersian ? starter.promptFa : starter.prompt)}
                className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-amber-600 hover:text-amber-200 disabled:opacity-30"
              >
                {isPersian ? starter.labelFa : starter.label}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={!chatReady}
            onClick={() =>
              void onSendQuery(
                isPersian
                  ? "یک تمرین بالینی غیرمنتظره روی دستگاه‌های بارگذاری‌شده شروع کن."
                  : "Start a case drill on any system currently loaded. Pick something I am unlikely to have practised.",
              )
            }
            className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-amber-600 hover:text-amber-200 disabled:opacity-30"
          >
            {isPersian ? "سناریوی تصادفی" : "Surprise me"}
          </button>
        </div>
        <p className="text-[10px] text-slate-700">
          {isPersian ? "بیماران شبیه‌سازی‌شده؛ صرفاً جهت تمرین آموزشی." : "Simulated patients, invented for practice."}
        </p>
      </div>
    );
  }

  if (mode === "review") {
    return (
      <ReviewIntro
        disabled={!chatReady}
        onAsk={() =>
          void onSendQuery(
            "Summarise this case: what was presented, what has been reasoned " +
              "across the visits, and where the gaps are.",
          )
        }
      />
    );
  }

  return null;
}

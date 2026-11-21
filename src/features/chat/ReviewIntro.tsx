import { activeCase, reviewReadiness, useCaseStore } from "@/stores/caseStore";

interface ReviewIntroProps {
  onAsk: () => void;
  disabled: boolean;
}

/**
 * Clinical Case Review Readiness Card.
 * Displays patient status, documented findings count, and summary action.
 */
export function ReviewIntro({ onAsk, disabled }: ReviewIntroProps) {
  const currentCase = useCaseStore(activeCase);
  const symptoms = useCaseStore((s) => s.symptoms);
  const visits = useCaseStore((s) => s.visits);
  const record = useCaseStore((s) => s.record);

  if (!currentCase) {
    return (
      <div className="p-6 text-center text-xs text-slate-500">
        <p className="font-medium text-slate-400">پرونده بیماری انتخاب نشده است</p>
        <p className="mt-1 text-slate-600">جهت سنتز و بررسی پرونده، ابتدا یک بیمار مجازی انتخاب کنید.</p>
      </div>
    );
  }

  const readiness = reviewReadiness(currentCase, symptoms, visits, record);
  const hasData = readiness.complaints > 0 || readiness.visits > 0 || !readiness.bare;

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center text-xs text-slate-400 shadow-sm mt-4">
      <div className="mb-2">
        <span className="inline-block rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400 border border-sky-500/20">
          مرور جامع پرونده (Clinical Synthesis)
        </span>
      </div>

      <h3 className="text-sm font-semibold text-slate-200">
        بررسی شواهد و سوابق {currentCase.title}
      </h3>
      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
        تحلیل جامع یافته‌های بالینی، شکایات ثبت‌شده و تشخیص‌های افتراقی بدون اعمال تغییر در پرونده بیمار.
      </p>

      {hasData && (
        <div className="my-3 flex justify-center gap-3 border-y border-slate-800/80 py-2 text-[11px] text-slate-400">
          {readiness.complaints > 0 && <span>{readiness.complaints} شکایت</span>}
          {readiness.visits > 0 && <span>{readiness.visits} نوبت ویزیت</span>}
          {readiness.updates > 0 && <span>{readiness.updates} ثبت بالینی</span>}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onAsk}
        className="mt-2 w-full rounded-lg bg-sky-600/90 py-1.5 px-3 text-xs font-medium text-white transition hover:bg-sky-500 disabled:opacity-40"
      >
        Summarise this case
      </button>
    </div>
  );
}

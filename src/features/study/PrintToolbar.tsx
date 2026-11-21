import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

export function PrintToolbar({ onDismiss }: { onDismiss: () => void }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  return (
    <div
      className="no-print mx-auto mb-4 flex max-w-[820px] items-start gap-2"
      dir={isPersian ? "rtl" : "ltr"}
    >
      <div className="text-[11px] leading-relaxed text-slate-400">
        <p>{isPersian ? "این پیش‌نمایش دقیقاً همان چیزی است که چاپ می‌شود." : "This is exactly what will be printed."}</p>
        <p className="text-slate-500">
          {isPersian ? (
            "در کادر چاپ، گزینه سرصفحه و پاورقی (Headers and footers) را غیرفعال کنید تا آدرس و تاریخ مرورگر درج نشود."
          ) : (
            <>
              In the print dialog, turn off{" "}
              <span className="text-slate-400">Headers and footers</span> — otherwise it
              stamps the page with its own date and address.
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto rounded border border-sky-600 bg-sky-600/15 px-3 py-1 text-xs text-sky-200 transition hover:bg-sky-600/30"
      >
        {isPersian ? "چاپ… یا ذخیره به صورت PDF" : "Print… or save as PDF"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500"
      >
        {isPersian ? "بستن · Esc" : "Close · Esc"}
      </button>
    </div>
  );
}

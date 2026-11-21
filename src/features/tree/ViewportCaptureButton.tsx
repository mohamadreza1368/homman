import { useState } from "react";
import { exportViewImage } from "@/features/viewer/exportView";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

export function ViewportCaptureButton() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const [isExporting, setIsExporting] = useState(false);
  const [exportOutcome, setExportOutcome] = useState<string | null>(null);

  const handleCapture = () => {
    setIsExporting(true);
    setExportOutcome(null);
    exportViewImage()
      .then((savedPath) => setExportOutcome(savedPath ? `Saved to ${savedPath}` : null))
      .catch((err: unknown) =>
        setExportOutcome(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setIsExporting(false));
  };

  return (
    <div className="pt-1">
      <button
        type="button"
        disabled={isExporting}
        onClick={handleCapture}
        title="Save the viewport, with its labels and its attribution, as a PNG"
        className="w-full rounded border border-slate-700 py-1 text-[11px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200 disabled:opacity-40"
      >
        {isExporting
          ? isPersian
            ? "در حال ذخیره…"
            : "Saving…"
          : isPersian
            ? "ذخیرهٔ نمای فعلی به‌عنوان تصویر"
            : "Save this view as an image"}
      </button>
      {exportOutcome && (
        <button
          type="button"
          onClick={() => setExportOutcome(null)}
          className="mt-1 block w-full truncate text-left text-[10px] text-slate-500 hover:text-slate-300"
          title={exportOutcome}
        >
          {exportOutcome}
        </button>
      )}
    </div>
  );
}

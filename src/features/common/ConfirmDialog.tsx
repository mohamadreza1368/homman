import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useConfirmStore } from "@/stores/confirmStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * Global accessible confirmation modal intercepting destructive or irreversible actions.
 */
export function ConfirmDialog() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const pendingPrompt = useConfirmStore((state) => state.pending);
  const resolveConfirmation = useConfirmStore((state) => state.answer);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pendingPrompt) return;
    cancelButtonRef.current?.focus();

    const handleKeyEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      resolveConfirmation(false);
    };

    window.addEventListener("keydown", handleKeyEscape, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyEscape, { capture: true });
  }, [pendingPrompt, resolveConfirmation]);

  if (!pendingPrompt) return null;

  return createPortal(
    <div
      dir={isPersian ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          resolveConfirmation(false);
        }
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="px-5 pb-4 pt-5">
          <h2 id="confirm-title" className="text-sm font-semibold text-slate-100">
            {pendingPrompt.title}
          </h2>

          {pendingPrompt.subject && (
            <p className="mt-3 max-h-24 overflow-hidden border-s-2 border-slate-700 ps-3 text-[12px] italic leading-relaxed text-slate-400">
              {pendingPrompt.subject}
            </p>
          )}

          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
            {pendingPrompt.body}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950/40 px-5 py-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={() => resolveConfirmation(false)}
            className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            {isPersian ? "انصراف" : "Keep it"}
          </button>
          <button
            type="button"
            onClick={() => resolveConfirmation(true)}
            className="rounded border border-rose-700 bg-rose-600/20 px-3 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-600/35"
          >
            {pendingPrompt.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

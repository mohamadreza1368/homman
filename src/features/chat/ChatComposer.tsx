import { GrowingTextarea } from "@/components/GrowingTextarea";
import type { SessionMode } from "@/lib/schemas";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { AskingGuide } from "./AskingGuide";

export interface ChatComposerProps {
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  chatReady: boolean;
  canSend: boolean;
  pendingRequestId: string | null;
  mode: SessionMode;
}

export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  onStop,
  chatReady,
  canSend,
  pendingRequestId,
  mode,
}: ChatComposerProps) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  return (
    <div className="shrink-0 border-t border-slate-800 p-3">
      <div className="relative">
        <GrowingTextarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void onSend();
            }
          }}
          rows={3}
          placeholder={
            !chatReady
              ? isPersian
                ? "ابتدا آدرس و مدل Custom API را در تنظیمات وارد کنید…"
                : "Configure Custom API Base URL and model first…"
              : mode === "review"
                ? isPersian
                  ? "دربارهٔ پرونده سؤال کنید…"
                  : "Ask for the summary, or about anything in the file…"
                : mode === "case"
                  ? isPersian
                    ? "به تمرین پاسخ دهید یا تمرین جدید بخواهید…"
                    : "Answer the case, or ask for a new one…"
                  : isPersian
                    ? "دربارهٔ آناتومی سؤال کنید…"
                    : "Ask about the anatomy…"
          }
          disabled={!chatReady}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-16 text-[13px] outline-none placeholder:text-slate-600 focus:border-sky-600 disabled:opacity-50"
        />
        {pendingRequestId ? (
          <button
            type="button"
            onClick={onStop}
            className="absolute bottom-2 right-2 rounded bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-100"
          >
            {isPersian ? "توقف" : "Stop"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="absolute bottom-2 right-2 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-medium disabled:opacity-30"
          >
            {isPersian ? "ارسال" : "Send"}
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-start gap-2">
        <p className="flex-1 text-[10px] text-slate-600">
          {isPersian ? "فقط برای آموزش؛ برای تشخیص یا درمان نیست." : "Educational use only — not for diagnosis or treatment."}
        </p>
        <AskingGuide />
      </div>
    </div>
  );
}

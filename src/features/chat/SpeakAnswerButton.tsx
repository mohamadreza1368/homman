import type { Language } from "@/lib/schemas";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { effectiveLanguage } from "./speech";
import { useSpokenAnswer } from "./useSpokenAnswer";

interface SpeakAnswerButtonProps {
  content: string;
  language: Language;
}

/**
 * Opt-in action button for synthesizing text-to-speech narration of a specific assistant response.
 */
export function SpeakAnswerButton({ content, language }: SpeakAnswerButtonProps) {
  const speechManager = useSpokenAnswer();
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const isSpeaking = speechManager.state === "speaking";

  const resolvedLocale = effectiveLanguage(language, content);

  if (!resolvedLocale || !speechManager.supports(resolvedLocale)) {
    return null;
  }

  const actionAria = isSpeaking
    ? isPersian
      ? "توقف خواندن صوتی"
      : "Stop reading aloud"
    : isPersian
      ? "خواندن صوتی این پاسخ"
      : "Read this answer aloud";

  const actionLabel = isSpeaking
    ? isPersian
      ? "توقف"
      : "Stop"
    : isPersian
      ? "خواندن صوتی"
      : "Read aloud";

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      speechManager.stop();
    } else {
      speechManager.speak(content, resolvedLocale);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggleSpeech}
        aria-label={actionAria}
        title={actionAria}
        className="text-[11px] text-slate-400 transition hover:text-slate-200"
      >
        {actionLabel}
      </button>

      {speechManager.error && (
        <span className="text-[10px] text-amber-400" role="status">
          {speechManager.error}
        </span>
      )}
    </>
  );
}

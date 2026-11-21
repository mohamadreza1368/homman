import {
  conversationIsCostly,
  formatTokens,
  totalTokens,
} from "@/features/usage/tokens";
import type { SessionMode } from "@/lib/schemas";
import { activeCase, useCaseStore } from "@/stores/caseStore";
import type { ChatMessage } from "@/stores/chatStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * Notice detailing cumulative token consumption for long sessions.
 */
export function CostNotice({ messages, mode }: { messages: ChatMessage[]; mode: SessionMode }) {
  const activePatient = useCaseStore(activeCase);
  const latestUsage = [...messages].reverse().find((item) => item.usage)?.usage;
  if (!conversationIsCostly(latestUsage)) return null;

  return (
    <p className="mx-3 mb-2 rounded border border-slate-700/70 bg-slate-800/40 px-2 py-1 text-[10px] leading-snug text-slate-400">
      Each question re-sends recent conversation context, so answers cost more the
      longer it runs — this one sent {formatTokens(totalTokens(latestUsage!))} tokens
      {latestUsage!.cache_read_tokens > 0 && (
        <>, {formatTokens(latestUsage!.cache_read_tokens)} of them re-read from the
        provider&rsquo;s cache at a reduced rate</>
      )}
      .{" "}
      {mode === "case" && activePatient
        ? "Starting a new visit keeps this patient's record and their marked complaints, and drops the transcript."
        : "Starting a new session drops the transcript."}
    </p>
  );
}

/**
 * Resets conversational exchange to start fresh.
 */
export function NewSessionButton({
  mode,
  onStart,
  disabled,
}: {
  mode: SessionMode;
  onStart: (mode: SessionMode) => void;
  disabled: boolean;
}) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  return (
    <button
      type="button"
      onClick={() => onStart(mode)}
      disabled={disabled}
      title={
        disabled
          ? "This conversation is already empty"
          : "Start a fresh conversation — this one is kept in Study"
      }
      className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-sky-600 hover:text-sky-300 disabled:cursor-default disabled:border-slate-800 disabled:text-slate-700 disabled:hover:border-slate-800 disabled:hover:text-slate-700"
    >
      {isPersian ? "جدید" : "New"}
    </button>
  );
}

/**
 * Toggles between anatomy tutor and clinical case simulation modes.
 */
export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: SessionMode;
  onChange: (mode: SessionMode) => void;
}) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const availableModes: { value: SessionMode; label: string }[] = [
    { value: "tutor", label: isPersian ? "آموزش" : "Tutor" },
    { value: "case", label: isPersian ? "تمرین موردی" : "Case drill" },
  ];

  return (
    <div className="flex overflow-hidden rounded border border-slate-700">
      {availableModes.map((entry) => {
        const isSelected = entry.value === mode;
        return (
          <button
            key={entry.value}
            type="button"
            onClick={() => !isSelected && onChange(entry.value)}
            aria-pressed={isSelected}
            title={
              isSelected
                ? entry.label
                : `Switch to ${entry.label.toLowerCase()} — starts a new session`
            }
            className={`px-2 py-0.5 text-[10px] transition ${
              isSelected
                ? "bg-slate-700/70 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

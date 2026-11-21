import { chatPreferences } from "@/stores/chatPreferences";
import type { ChatMessage } from "@/stores/chatStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { describeTurnCost } from "@/features/usage/tokens";
import { Markdown } from "./Markdown";
import { stripOrganRefs } from "./organRefs";
import { SpeakAnswerButton } from "./SpeakAnswerButton";
import { ToolTrail } from "./ChatToolTrail";
import {
  CopyButton,
  ReferenceLegend,
  RestoreViewButton,
  SaveAsNoteButton,
  ScoreBadge,
} from "./ChatTurnActions";

/**
 * Renders an individual message turn in the dialogue list.
 */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  if (message.role === "user") {
    return (
      <div className="group flex flex-col items-end gap-1">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-teal-500/30 bg-gradient-to-br from-teal-700/25 via-slate-800/40 to-sky-700/20 px-3.5 py-2.5 text-[13px] text-slate-100 shadow-md backdrop-blur-md">
          {message.content}
        </div>
        <div className="opacity-0 transition group-hover:opacity-100">
          <CopyButton text={message.content} />
        </div>
      </div>
    );
  }

  const isBlankContent = message.content.trim().length === 0;

  return (
    <div className="group flex flex-col gap-1">
      <div className="rounded-2xl rounded-bl-sm border border-slate-700/60 bg-slate-900/80 px-3.5 py-2.5 shadow-xl backdrop-blur-xl ring-1 ring-white/5">
        {message.score !== undefined && <ScoreBadge score={message.score} />}
        {isBlankContent && message.status === "streaming" ? (
          <span className="inline-flex gap-1 py-1" aria-label="Thinking">
            {[0, 1, 2].map((pulseIdx) => (
              <span
                key={pulseIdx}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500"
                style={{ animationDelay: `${pulseIdx * 160}ms` }}
              />
            ))}
          </span>
        ) : (
          <Markdown>{message.content}</Markdown>
        )}

        <ToolTrail tools={message.tools} />
        <ReferenceLegend content={message.content} />

        {message.status === "error" && (
          <p className="mt-2 rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-[11px] text-rose-300">
            {message.error}
          </p>
        )}
        {message.status === "cancelled" && (
          <p className="mt-2 text-[11px] italic text-slate-500">{isPersian ? "متوقف شد." : "Stopped."}</p>
        )}
      </div>

      {!isBlankContent && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
            <CopyButton text={stripOrganRefs(message.content)} label={isPersian ? "کپی پاسخ" : "Copy answer"} />
            <SaveAsNoteButton content={message.content} />
            {message.commands && <RestoreViewButton commands={message.commands} />}
            <SpeakAnswerButton content={message.content} language={chatPreferences().language} />
          </div>

          <span className="ml-auto flex items-baseline gap-1.5 text-[10px] text-slate-600">
            {message.model && (
              <span className="max-w-[11rem] truncate" title={`Answered by ${message.model}`}>
                {message.model}
              </span>
            )}
            {message.model && message.usage && <span className="text-slate-700">·</span>}
            {message.usage && (
              <span className="tabular-nums" title={describeTurnCost(message.usage).detail}>
                {describeTurnCost(message.usage).label}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

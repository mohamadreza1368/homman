import { memo } from "react";
import { Markdown } from "@/features/chat/Markdown";
import { stripOrganRefs } from "@/features/chat/organRefs";
import type { Memory } from "./memories";
import {
  CLASSIFICATION_TITLES,
  ERASE_HOLD_DURATION_MS,
  formatEpochTimestamp,
  type MemoryInspectionState,
} from "./memoryLabUtils";

export interface MemoryReaderProps {
  memory: Memory;
  reading: MemoryInspectionState | null;
  wide: boolean;
  holding: boolean;
  onToggleWide: () => void;
  onClose: (key: null) => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onHoldDone: (key: string) => void;
}

export const MemoryReader = memo(function MemoryReader({
  memory,
  reading,
  wide,
  holding,
  onToggleWide,
  onClose,
  onHoldStart,
  onHoldEnd,
  onHoldDone,
}: MemoryReaderProps) {
  return (
    <>
      <h3>
        {CLASSIFICATION_TITLES[memory.kind]} <span>{formatEpochTimestamp(memory.at)}</span>
        <button
          type="button"
          className="ml-expand"
          onClick={onToggleWide}
          title={wide ? "Back to the side" : "Read it large"}
          aria-pressed={wide}
        >
          {wide ? "⤡" : "⤢"}
        </button>
      </h3>
      <div className="ml-reading-title">{memory.title}</div>
      <div className="ml-reading">
        {reading?.state === "loading" && <p className="ml-faint">RECALLING…</p>}
        {reading?.state === "missing" && (
          <p className="ml-faint">This memory is no longer in the journal.</p>
        )}
        {reading?.state === "note" && <p className="ml-note">{stripOrganRefs(reading.note.body)}</p>}
        {reading?.state === "session" && (
          <>
            {reading.detail.session.score !== null && (
              <p className="ml-score">
                SCORE {reading.detail.session.score}
                {reading.detail.session.verdict ? ` · ${reading.detail.session.verdict}` : ""}
              </p>
            )}
            {reading.detail.messages.map((msg, idx) => (
              <div key={idx} className={`ml-message ml-${msg.role}`}>
                <span>{msg.role === "user" ? "YOU" : "ASSISTANT"}</span>
                {msg.role === "assistant" ? (
                  <Markdown structurePins={false}>{stripOrganRefs(msg.content)}</Markdown>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
      <div className="ml-actions">
        <button type="button" className="ml-close-reading" onClick={() => onClose(null)}>
          CLOSE
        </button>
        <button
          type="button"
          className={`ml-erase ${holding ? "ml-holding" : ""}`}
          style={{ ["--ml-hold" as string]: `${ERASE_HOLD_DURATION_MS}ms` }}
          onPointerDown={onHoldStart}
          onPointerUp={onHoldEnd}
          onPointerLeave={onHoldEnd}
          onAnimationEnd={() => onHoldDone(memory.key)}
          title="Hold to erase this memory from your journal"
        >
          <i />
          HOLD TO ERASE
        </button>
      </div>
    </>
  );
});

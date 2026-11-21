import { memo } from "react";
import type { Memory } from "./memories";
import { formatEpochTimestamp } from "./memoryLabUtils";

export interface MemoryTimelineProps {
  memories: Memory[];
  erased: Set<string>;
  selected: string | null;
  onChoose: (key: string | null) => void;
  onHover: (key: string | null) => void;
}

export const MemoryTimeline = memo(function MemoryTimeline({
  memories,
  erased,
  selected,
  onChoose,
  onHover,
}: MemoryTimelineProps) {
  const extractKeyFromEvent = (evtTarget: EventTarget | null) => {
    const tickKey = (evtTarget as HTMLElement | null)?.closest<HTMLElement>(".ml-tick")?.dataset.key;
    return tickKey && !erased.has(tickKey) ? tickKey : null;
  };

  return (
    <div
      className="ml-timeline"
      aria-label="Memories in the order they were made"
      onClick={(e) => {
        const foundKey = extractKeyFromEvent(e.target);
        if (foundKey) onChoose(foundKey);
      }}
      onMouseOver={(e) => onHover(extractKeyFromEvent(e.target))}
      onMouseLeave={() => onHover(null)}
    >
      {memories.map((entry) => (
        <button
          type="button"
          key={entry.key}
          data-key={entry.key}
          className={`ml-tick ml-${entry.kind} ${erased.has(entry.key) ? "ml-gone" : ""} ${
            entry.key === selected ? "ml-on" : ""
          }`}
          aria-label={`${entry.title}, ${formatEpochTimestamp(entry.at)}`}
        />
      ))}
    </div>
  );
});

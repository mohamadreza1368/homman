import { memo, useCallback } from "react";
import type { Memory } from "./memories";

export interface MemoryTimelineProps {
  memories: Memory[];
  erased: Set<string>;
  selected: string | null;
  onChoose: (key: string | null) => void;
  onHover: (key: string | null) => void;
}

/**
 * Interactive Chronological Scrubber Timeline.
 * Presents temporal distribution of spatial memories with hover inspection and selection.
 */
export const MemoryTimeline = memo(function MemoryTimeline({
  memories,
  erased,
  selected,
  onChoose,
  onHover,
}: MemoryTimelineProps) {
  const handleMarkerClick = useCallback(
    (key: string) => {
      if (!erased.has(key)) {
        onChoose(key);
      }
    },
    [erased, onChoose],
  );

  return (
    <nav
      aria-label="خط زمانی خاطرات یادگیری"
      className="flex h-12 items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/80 px-4 py-2 shadow-inner"
    >
      {memories.map((m) => {
        const isErased = erased.has(m.key);
        const isSelected = m.key === selected;

        return (
          <button
            key={m.key}
            type="button"
            disabled={isErased}
            onClick={() => handleMarkerClick(m.key)}
            onMouseEnter={() => !isErased && onHover(m.key)}
            onMouseLeave={() => onHover(null)}
            title={`${m.title} (${new Date(m.at).toLocaleDateString()})`}
            className={`group relative flex h-7 items-center justify-center transition-all ${
              isErased ? "opacity-20 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <div
              className={`w-2 transition-all rounded-full ${
                isSelected
                  ? "h-7 bg-sky-400 ring-2 ring-sky-400/30 scale-110"
                  : m.kind === "session"
                    ? "h-4 bg-sky-600/70 group-hover:h-6 group-hover:bg-sky-400"
                    : m.kind === "case"
                      ? "h-4 bg-amber-600/70 group-hover:h-6 group-hover:bg-amber-400"
                      : "h-4 bg-emerald-600/70 group-hover:h-6 group-hover:bg-emerald-400"
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
});

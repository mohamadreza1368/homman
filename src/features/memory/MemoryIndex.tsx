import { memo, useMemo } from "react";
import { byMonth, tally, type Memory } from "./memories";
import { CLASSIFICATION_TITLES } from "./memoryLabUtils";

export interface MemoryIndexProps {
  live: Memory[];
  selected: string | null;
  onChoose: (key: string | null) => void;
}

export const MemoryIndex = memo(function MemoryIndex({
  live,
  selected,
  onChoose,
}: MemoryIndexProps) {
  const kindTally = useMemo(() => tally(live), [live]);
  const monthDist = useMemo(() => byMonth(live), [live]);
  const maxBucketCount = Math.max(1, ...monthDist.map((m) => m.count));
  const recentHistory = useMemo(() => [...live].reverse().slice(0, 12), [live]);

  return (
    <>
      <h3>
        MEMORY INDEX <span>{String(live.length).padStart(3, "0")}</span>
      </h3>
      {(["session", "case", "note"] as const).map((kind) => (
        <div key={kind} className="ml-count">
          <i className={`ml-dot ml-${kind}`} />
          <span>{CLASSIFICATION_TITLES[kind]}S</span>
          <b>{kindTally[kind]}</b>
        </div>
      ))}
      <h3 className="ml-gap">BY MONTH</h3>
      <div className="ml-months">
        {monthDist.map((m) => (
          <div key={m.month} className="ml-month" title={`${m.month}: ${m.count}`}>
            <i style={{ height: `${(m.count / maxBucketCount) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="ml-months-scale">
        <span>{monthDist[0]?.month}</span>
        <span>{monthDist[monthDist.length - 1]?.month}</span>
      </div>
      <h3 className="ml-gap">RECENT</h3>
      <ol className="ml-recent">
        {recentHistory.map((m) => (
          <li key={m.key}>
            <button
              type="button"
              onClick={() => onChoose(m.key)}
              className={m.key === selected ? "ml-on" : ""}
            >
              <i className={`ml-dot ml-${m.kind}`} />
              <em>{m.title}</em>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
});

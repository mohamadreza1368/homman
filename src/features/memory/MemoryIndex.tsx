import { memo, useMemo } from "react";
import { byMonth, tally, type Memory } from "./memories";

export interface MemoryIndexProps {
  live: Memory[];
  selected: string | null;
  onChoose: (key: string | null) => void;
}

const CATEGORY_LABELS = {
  session: "جلسات یادگیری",
  case: "بیماران مجازی",
  note: "یادداشت‌ها",
} as const;

/**
 * Educational Memory Index Drawer.
 * Renders spatial journal analytics, category breakdown, monthly histogram, and recent history.
 */
export const MemoryIndex = memo(function MemoryIndex({
  live,
  selected,
  onChoose,
}: MemoryIndexProps) {
  const countsByCategory = useMemo(() => tally(live), [live]);
  const monthlyMetrics = useMemo(() => byMonth(live), [live]);
  const peakMonthlyVolume = Math.max(1, ...monthlyMetrics.map((item) => item.count));
  const latestActivityList = useMemo(() => [...live].reverse().slice(0, 10), [live]);

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300 flex flex-col gap-4 select-none">
      {/* Header Metric */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h2 className="font-semibold text-slate-100 tracking-wide text-xs">شاخص حافظه مکانی</h2>
        <span className="rounded bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] text-sky-400 border border-sky-500/20">
          {String(live.length).padStart(3, "0")}
        </span>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-1.5">
        {(["session", "case", "note"] as const).map((kind) => (
          <div
            key={kind}
            className="flex items-center justify-between rounded-lg bg-slate-900/60 px-2.5 py-1.5 border border-slate-800/60"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  kind === "session"
                    ? "bg-sky-400"
                    : kind === "case"
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                }`}
              />
              <span className="text-[11px] text-slate-300">{CATEGORY_LABELS[kind]}</span>
            </div>
            <span className="font-mono text-xs font-medium text-slate-100">
              {countsByCategory[kind]}
            </span>
          </div>
        ))}
      </div>

      {/* Monthly Distribution Histogram */}
      {monthlyMetrics.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            توزیع زمانی (ماهانه)
          </span>
          <div className="flex h-16 items-end gap-1 rounded-lg bg-slate-900/40 p-2 border border-slate-800/40">
            {monthlyMetrics.map((col) => {
              const heightPct = Math.round((col.count / peakMonthlyVolume) * 100);
              return (
                <div
                  key={col.month}
                  title={`${col.month}: ${col.count} مورد`}
                  className="group relative flex-1 h-full flex items-end"
                >
                  <div
                    style={{ height: `${Math.max(12, heightPct)}%` }}
                    className="w-full rounded-t bg-sky-500/60 group-hover:bg-sky-400 transition-colors"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 font-mono px-1">
            <span>{monthlyMetrics[0]?.month}</span>
            <span>{monthlyMetrics[monthlyMetrics.length - 1]?.month}</span>
          </div>
        </div>
      )}

      {/* Recent Memories Feed */}
      <div className="flex-1 flex flex-col min-h-0 space-y-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          فعالیت‌های اخیر
        </span>
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {latestActivityList.map((entry) => {
            const isTarget = entry.key === selected;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => onChoose(entry.key)}
                className={`w-full text-right rounded-lg px-2.5 py-1.5 text-xs transition-all flex items-center justify-between border ${
                  isTarget
                    ? "bg-sky-950/50 border-sky-500/50 text-sky-200"
                    : "border-transparent bg-slate-900/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <span className="truncate">{entry.title}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ml-2 ${
                    entry.kind === "session"
                      ? "bg-sky-400"
                      : entry.kind === "case"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
});

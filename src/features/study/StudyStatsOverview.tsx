import { useStudyStore } from "@/stores/studyStore";

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-slate-800/70 px-1.5 py-0.5 text-slate-400">
      {value} {label}
    </span>
  );
}

export function StudyStatsOverview() {
  const currentStats = useStudyStore((state) => state.stats);
  if (!currentStats || currentStats.sessions + currentStats.notes === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <StatItem label="sessions" value={currentStats.sessions} />
      {currentStats.cases > 0 && <StatItem label="cases" value={currentStats.cases} />}
      <StatItem label="notes" value={currentStats.notes} />
      {currentStats.average_score !== null && (
        <span
          title={`Across ${currentStats.graded_cases} graded case drill(s)`}
          className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300"
        >
          avg {Math.round(currentStats.average_score)}/100
        </span>
      )}
    </div>
  );
}

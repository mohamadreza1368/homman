import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { CURRENT_CROSSING } from "./scanCrossing";
import { tissueColour } from "./palette";

export interface SliceTableProps {
  compact: boolean;
}

export function SliceTable({ compact }: SliceTableProps) {
  const organMap = useSceneStore((s) => s.organs);
  const { organIds, total } = CURRENT_CROSSING.value;
  if (organIds.length === 0) return null;
  const remainingCount = Math.max(0, total - organIds.length);

  return (
    <ul className={compact ? "mt-1 space-y-0.5" : "space-y-1"}>
      {organIds.map((organId) => {
        const organ = organMap[organId];
        return (
          <li key={organId} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{
                backgroundColor: organ
                  ? `#${tissueColour(organ).getHexString()}`
                  : "#475569",
              }}
            />
            <span
              className={`truncate italic ${
                compact ? "text-[9px] text-cyan-100/80" : "text-[11px] text-cyan-100"
              }`}
            >
              {organ ? organLabel(organ) : organId}
            </span>
          </li>
        );
      })}
      {remainingCount > 0 && (
        <li className={compact ? "text-[9px] text-slate-500" : "text-[11px] text-slate-500"}>
          and {remainingCount} more
        </li>
      )}
    </ul>
  );
}

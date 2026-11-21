import { formatDistance, measureCm, pointOnScreen } from "./axialSlice";
import type { SectionMeasure, SliceWindow } from "./axialSlice";
import { AXIAL_PROBE } from "./AxialProbe";

export interface AxialMeasureOverlayProps {
  activeMeasures: SectionMeasure[];
  activeDraftMeasure: SectionMeasure | null;
  computedFrameWidth: number;
  currentWindow: SliceWindow;
  onRemoveMeasure: (line: SectionMeasure) => void;
}

export function AxialMeasureOverlay({
  activeMeasures,
  activeDraftMeasure,
  computedFrameWidth,
  currentWindow,
  onRemoveMeasure,
}: AxialMeasureOverlayProps) {
  if ((activeMeasures.length === 0 && !activeDraftMeasure) || computedFrameWidth <= 0) {
    return null;
  }

  const allVisibleLines = [...activeMeasures, ...(activeDraftMeasure ? [activeDraftMeasure] : [])];

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${computedFrameWidth} ${computedFrameWidth}`}
      aria-hidden
    >
      {allVisibleLines.map((line) => {
        const pA = pointOnScreen(
          currentWindow,
          line.ah,
          line.av,
          computedFrameWidth,
          AXIAL_PROBE.basis,
        );
        const pB = pointOnScreen(
          currentWindow,
          line.bh,
          line.bv,
          computedFrameWidth,
          AXIAL_PROBE.basis,
        );
        const distCm = measureCm(line);
        const isExisting = line !== activeDraftMeasure;

        return (
          <g key={`${line.plane}:${line.ah}:${line.av}:${line.bh}:${line.bv}:${line.at}`}>
            <line
              x1={pA.x}
              y1={pA.y}
              x2={pB.x}
              y2={pB.y}
              stroke="#22d3ee"
              strokeWidth={1.5}
            />
            <circle cx={pA.x} cy={pA.y} r={3} fill="#22d3ee" />
            <circle cx={pB.x} cy={pB.y} r={3} fill="#22d3ee" />
            {distCm > 0 && (
              <text
                x={(pA.x + pB.x) / 2 + 8}
                y={(pA.y + pB.y) / 2 - 8}
                fill="#a5f3fc"
                fontSize={13}
                stroke="#020617"
                strokeWidth={3}
                paintOrder="stroke"
                style={isExisting ? { pointerEvents: "auto", cursor: "pointer" } : undefined}
                onPointerDown={
                  isExisting
                    ? (e) => {
                        e.stopPropagation();
                        onRemoveMeasure(line);
                      }
                    : undefined
                }
              >
                {isExisting && <title>Remove this measurement</title>}
                {formatDistance(distCm)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

import { useEffect, useState } from 'react';
import type { AnatomyViewer, AnatomicalCallout } from '../engine/AnatomyViewer';
import { DEFAULT_CALLOUTS } from '../engine/AnatomyViewer';

interface Props {
  viewer: AnatomyViewer | null;
  onSelectCallout: (callout: AnatomicalCallout) => void;
}

export function CalloutLeaderLines({ viewer, onSelectCallout }: Props) {
  const [points, setPoints] = useState<
    { callout: AnatomicalCallout; x: number; y: number; visible: boolean; isRightSide: boolean }[]
  >([]);

  useEffect(() => {
    if (!viewer) return;

    let frameId: number;

    const updatePositions = () => {
      const containerWidth = viewer.renderer.domElement.clientWidth;
      const updated = DEFAULT_CALLOUTS.map((callout) => {
        const { x, y, visible } = viewer.projectToScreen(callout.worldPos);
        // Is it on the right or left half of the screen
        const isRightSide = x > containerWidth / 2;
        return {
          callout,
          x,
          y,
          visible,
          isRightSide
        };
      });

      setPoints(updated);
      frameId = requestAnimationFrame(updatePositions);
    };

    frameId = requestAnimationFrame(updatePositions);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [viewer]);

  if (!viewer) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20" dir="ltr">
      <svg className="w-full h-full absolute inset-0">
        {points.map(({ callout, x, y, visible, isRightSide }) => {
          if (!visible) return null;

          // Staggered line length to prevent label collisions
          let lineLength = 65;
          if (callout.id === 'LUNGS') lineLength = 120;
          if (callout.id === 'HEART') lineLength = 65;
          if (callout.id === 'RESPIRATORY') lineLength = 105;
          if (callout.id === 'BICEPS') lineLength = 70;
          if (callout.id === 'LIVER') lineLength = 95;
          if (callout.id === 'LYMPHATIC') lineLength = 85;

          const targetX = isRightSide ? x + lineLength : x - lineLength;

          return (
            <g key={callout.id} className="transition-all duration-75">
              {/* Center target circle on organ */}
              <circle
                cx={x}
                cy={y}
                r="3.5"
                className="fill-sky-400 stroke-slate-900 stroke-[1.5]"
              />
              {/* Leader line */}
              <line
                x1={x}
                y1={y}
                x2={targetX}
                y2={y}
                className="stroke-slate-400/80 stroke-[1.5]"
                strokeDasharray="none"
              />
            </g>
          );
        })}
      </svg>

      {/* Interactive HTML Callout Labels */}
      {points.map(({ callout, x, y, visible, isRightSide }) => {
        if (!visible) return null;

        // Staggered line length to match SVG
        let lineLength = 65;
        if (callout.id === 'LUNGS') lineLength = 120;
        if (callout.id === 'HEART') lineLength = 65;
        if (callout.id === 'RESPIRATORY') lineLength = 105;
        if (callout.id === 'BICEPS') lineLength = 70;
        if (callout.id === 'LIVER') lineLength = 95;
        if (callout.id === 'LYMPHATIC') lineLength = 85;

        const labelX = isRightSide ? x + lineLength + 6 : x - lineLength - 6;

        return (
          <div
            key={callout.id}
            style={{
              position: 'absolute',
              left: `${labelX}px`,
              top: `${y - 12}px`,
              transform: isRightSide ? 'none' : 'translateX(-100%)',
            }}
            className="pointer-events-auto cursor-pointer group flex items-center gap-1.5"
            onClick={() => onSelectCallout(callout)}
          >
            <div className="px-2.5 py-1 rounded bg-slate-900/85 backdrop-blur-md border border-slate-700/70 text-slate-200 text-xs font-medium shadow-lg hover:border-sky-400 hover:text-sky-300 hover:bg-slate-800 transition-all flex items-center gap-1.5">
              <span>{callout.labelEn}</span>
              <span className="text-[10px] text-slate-400 group-hover:text-sky-400/80 font-normal">
                {callout.labelFa}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

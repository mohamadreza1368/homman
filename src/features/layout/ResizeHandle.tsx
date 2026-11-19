import { useCallback, useEffect, useRef } from "react";

import type { WidthUpdate } from "./useLayout";

interface ResizeHandleProps {
  width: number;
  onResize: (update: WidthUpdate) => void;
  side: "left" | "right";
  min: number;
  max: number;
  label: string;
  defaultWidth: number;
}

const STEP_DELTA = 16;

/**
 * Interactive split divider enabling mouse drag resizing and keyboard step adjustments for side panels.
 */
export function ResizeHandle({
  width,
  onResize,
  side,
  min,
  max,
  label,
  defaultWidth,
}: ResizeHandleProps) {
  const isDraggingRef = useRef(false);
  const dragOriginX = useRef(0);
  const initialWidthRef = useRef(0);
  const cursorUnlockCleanup = useRef<(() => void) | null>(null);

  const engageCursorLock = useCallback(() => {
    if (cursorUnlockCleanup.current) return;
    const bodyStyle = document.body.style;
    const previousCursorStyle = bodyStyle.cursor;
    const previousUserSelect = bodyStyle.userSelect;

    bodyStyle.cursor = "col-resize";
    bodyStyle.userSelect = "none";

    cursorUnlockCleanup.current = () => {
      bodyStyle.cursor = previousCursorStyle;
      bodyStyle.userSelect = previousUserSelect;
      cursorUnlockCleanup.current = null;
    };
  }, []);

  useEffect(() => () => cursorUnlockCleanup.current?.(), []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      isDraggingRef.current = true;
      dragOriginX.current = event.clientX;
      initialWidthRef.current = width;

      engageCursorLock();
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [width, engageCursorLock],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const horizontalOffset = event.clientX - dragOriginX.current;
      const signedOffset = side === "left" ? horizontalOffset : -horizontalOffset;
      onResize(initialWidthRef.current + signedOffset);
    },
    [onResize, side],
  );

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    cursorUnlockCleanup.current?.();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={() => onResize(defaultWidth)}
      onKeyDown={(event) => {
        const adjustmentSign = side === "left" ? -STEP_DELTA : STEP_DELTA;
        if (event.key === "ArrowLeft") {
          onResize((prev) => prev + adjustmentSign);
        } else if (event.key === "ArrowRight") {
          onResize((prev) => prev - adjustmentSign);
        } else if (event.key === "Home") {
          onResize(defaultWidth);
        } else {
          return;
        }
        event.preventDefault();
      }}
      className="group relative w-1 shrink-0 cursor-col-resize bg-slate-800 transition-colors hover:bg-sky-600 focus-visible:bg-sky-500 focus-visible:outline-none"
    >
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );
}

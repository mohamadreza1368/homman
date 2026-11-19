import type { FocusMargins } from "./scene/memoryScene";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const CALLOUT_REACH = 44;

export interface CalloutPlacement {
  side: "right" | "left";
  maxWidth: number;
}

/**
 * Calculates unobscured viewport margins around active HUD surfaces, reserving
 * center staging area for 3D holographic rendering.
 */
export function freeMargins(
  panels: readonly Box[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 16,
): FocusMargins {
  const result: FocusMargins = { left: 0, right: 0, top: 0, bottom: 0 };

  for (const box of panels) {
    const spanX = box.right - box.left;
    const spanY = box.bottom - box.top;
    if (spanX <= 0 || spanY <= 0) continue;

    // Panels covering more than 55% of width are treated as horizontal ribbons
    const isHorizontal = spanX > viewportWidth * 0.55;
    if (isHorizontal) {
      const midY = (box.top + box.bottom) * 0.5;
      if (midY > viewportHeight * 0.5) {
        result.bottom = Math.max(result.bottom, viewportHeight - box.top + padding);
      } else {
        result.top = Math.max(result.top, box.bottom + padding);
      }
    } else {
      const midX = (box.left + box.right) * 0.5;
      if (midX < viewportWidth * 0.5) {
        result.left = Math.max(result.left, box.right + padding);
      } else {
        result.right = Math.max(result.right, viewportWidth - box.left + padding);
      }
    }
  }

  // Constrain margins so that at least one third of viewport is always retained
  const limitAxis = (m1: number, m2: number, totalSpan: number): readonly [number, number] => {
    const minReserve = totalSpan / 3;
    const available = totalSpan - m1 - m2;
    if (available >= minReserve) {
      return [m1, m2];
    }
    const ratio = (totalSpan - minReserve) / Math.max(1, m1 + m2);
    return [m1 * ratio, m2 * ratio];
  };

  const [clampedLeft, clampedRight] = limitAxis(result.left, result.right, viewportWidth);
  const [clampedTop, clampedBottom] = limitAxis(result.top, result.bottom, viewportHeight);

  result.left = clampedLeft;
  result.right = clampedRight;
  result.top = clampedTop;
  result.bottom = clampedBottom;

  return result;
}

/**
 * Determines optimal lateral positioning and maximum allowable width for a memory tag.
 */
export function calloutPlacement(
  targetX: number,
  preferredWidth: number,
  minX: number,
  maxX: number,
  borderGap = 12,
): CalloutPlacement {
  const rightSpace = maxX - borderGap - (targetX + CALLOUT_REACH);
  const leftSpace = targetX - CALLOUT_REACH - (minX + borderGap);

  const shouldPlaceRight = rightSpace >= preferredWidth || rightSpace >= leftSpace;
  const chosenSide: "right" | "left" = shouldPlaceRight ? "right" : "left";
  const usableBound = shouldPlaceRight ? rightSpace : leftSpace;

  return {
    side: chosenSide,
    maxWidth: Math.max(0, Math.floor(usableBound)),
  };
}

/**
 * Calculates visible organ row count allowed in the side pane based on vertical space.
 */
export function studiedRowsFor(paneHeight: number): number {
  const calculated = Math.floor(paneHeight / 110);
  return Math.min(6, Math.max(3, calculated));
}

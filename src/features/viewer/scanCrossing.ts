/**
 * Hoomaan 3D Viewer - Realtime Scanner Plane Anatomical Intersection Tracker
 */

import { scanRangeAlong, type ScanAxis } from "./scanBand";

export interface Extent {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface Crossing {
  organIds: string[];
  total: number;
}

export const NOTHING_CROSSED: Crossing = { organIds: [], total: 0 };

/** Resolves list of anatomical structures intersecting scan plane at specified distance along axis. */
export function crossingAt(
  boxes: ReadonlyMap<string, Extent>,
  at: number,
  axis: ScanAxis,
  limit: number,
): Crossing {
  const matches: { organId: string; volume: number }[] = [];

  for (const [organId, box] of boxes) {
    const { from, to } = scanRangeAlong(
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.max.y, box.max.z],
      axis,
    );
    if (at < from || at > to) continue;

    matches.push({
      organId,
      volume:
        (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z),
    });
  }

  matches.sort((a, b) => b.volume - a.volume || a.organId.localeCompare(b.organId));
  return {
    organIds: matches.slice(0, Math.max(0, limit)).map((item) => item.organId),
    total: matches.length,
  };
}

/** Compares two crossing structures for identity to avoid redundant UI renders. */
export function sameCrossing(a: Crossing, b: Crossing): boolean {
  if (a.total !== b.total || a.organIds.length !== b.organIds.length) return false;
  return a.organIds.every((id, idx) => id === b.organIds[idx]);
}

export const CURRENT_CROSSING: { value: Crossing } = { value: NOTHING_CROSSED };
export const SWEEP_RUNNING = { value: false };
export const CROSSING_INTERVAL_S = 1 / 6;
export const CROSSING_LIMIT = 6;

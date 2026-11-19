/**
 * Hoomaan 3D Viewer - Freehand Lasso Area Selection
 */

import * as THREE from "three";
import { projectToScreen } from "./viewerBridge";

export interface Point {
  x: number;
  y: number;
}

/** Minimum pixel drag distance to qualify as a valid selection lasso. */
export const MIN_DRAG = 8;

/** Granularity threshold between points in the lasso trajectory. */
export const PATH_RESOLUTION = 4;

/** Appends a point to the lasso path if minimum resolution threshold is reached. */
export function extendPath(path: Point[], next: Point): Point[] {
  const last = path[path.length - 1];
  if (last && Math.hypot(next.x - last.x, next.y - last.y) < PATH_RESOLUTION) {
    return path;
  }
  return [...path, next];
}

/** Computes axis-aligned bounding box enclosing the given 2D points. */
export function pathBounds(path: Point[]): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;

  for (const p of path) {
    if (p.x < left) left = p.x;
    if (p.x > right) right = p.x;
    if (p.y < top) top = p.y;
    if (p.y > bottom) bottom = p.y;
  }
  return { left, top, right, bottom };
}

/** Validates whether the drawn lasso represents an intentional selection loop. */
export function isLassoMeaningful(path: Point[]): boolean {
  if (path.length < 3) return false;
  const b = pathBounds(path);
  return b.right - b.left >= MIN_DRAG || b.bottom - b.top >= MIN_DRAG;
}

/** Ray-casting test determining whether 2D point (x, y) is inside the polygon path. */
export function pointInPath(x: number, y: number, path: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const a = path[i]!;
    const b = path[j]!;
    const crossesY = a.y > y !== b.y > y;
    if (crossesY && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Projects visible organ centres onto screen and collects structures enclosed by the lasso.
 */
export function collectInPath(
  candidates: { organ_id: string }[],
  centres: { get(organId: string): THREE.Vector3 | undefined },
  camera: THREE.Camera,
  width: number,
  height: number,
  path: Point[],
): string[] {
  if (!isLassoMeaningful(path)) return [];
  const bounds = pathBounds(path);
  const matched: string[] = [];

  for (const candidate of candidates) {
    const centre = centres.get(candidate.organ_id);
    if (!centre) continue;

    const screenPos = projectToScreen(centre, camera, width, height);
    if (screenPos.behind) continue;

    if (
      screenPos.x < bounds.left ||
      screenPos.x > bounds.right ||
      screenPos.y < bounds.top ||
      screenPos.y > bounds.bottom
    ) {
      continue;
    }

    if (pointInPath(screenPos.x, screenPos.y, path)) {
      matched.push(candidate.organ_id);
    }
  }

  return matched;
}

let suppressUntil = 0;
const SUPPRESS_DELAY_MS = 250;

/** Temporarily suppresses pointer click events immediately following a lasso drag gesture. */
export function suppressNextClick(): void {
  suppressUntil = Date.now() + SUPPRESS_DELAY_MS;
}

/** Returns true if subsequent click event should be discarded following lasso completion. */
export function shouldSuppressClick(): boolean {
  if (Date.now() > suppressUntil) return false;
  suppressUntil = 0;
  return true;
}

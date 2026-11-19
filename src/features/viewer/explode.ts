/**
 * Hoomaan 3D Viewer - Exploded View Offset Calculation
 */

import * as THREE from "three";

/** Discrete progression steps for keyboard-driven explode cycling. */
export const EXPLODE_STOPS = [0, 0.35, 0.9, 1.8] as const;

/** Maximum allowed explosion expansion factor. */
export const MAX_EXPLODE = 2;

/** Calculates the next explode step, wrapping back to 0 at the end. */
export function nextExplodeStop(current: number): number {
  const next = EXPLODE_STOPS.find((stop) => stop > current + 1e-6);
  return next ?? EXPLODE_STOPS[0]!;
}

export type ExplodeScope = "selection" | "region" | "everything";

/** Determines the contextual scope of anatomy affected by exploded view expansion. */
export function explodeScope(state: {
  selectedOrganIds: string[];
  isolatedOrganIds: string[] | null;
}): ExplodeScope {
  if (state.selectedOrganIds.length >= 2) return "selection";
  if (state.isolatedOrganIds !== null && state.isolatedOrganIds.length >= 2) return "region";
  return "everything";
}

/** Resolves the list of organ identifiers participating in the exploded view. */
export function explodeMembers(
  state: { selectedOrganIds: string[]; isolatedOrganIds: string[] | null },
  loaded: Iterable<string>,
): string[] {
  switch (explodeScope(state)) {
    case "selection":
      return state.selectedOrganIds;
    case "region":
      return state.isolatedOrganIds ?? [];
    case "everything":
      return [...loaded];
  }
}

/** Computes the geometric bounding box center pivot for participating structures. */
export function explodePivot(
  ids: Iterable<string>,
  centres: Map<string, THREE.Vector3>,
): THREE.Vector3 | null {
  const box = new THREE.Box3();
  let hasValid = false;

  for (const id of ids) {
    const centre = centres.get(id);
    if (!centre) continue;
    box.expandByPoint(centre);
    hasValid = true;
  }

  return hasValid ? box.getCenter(new THREE.Vector3()) : null;
}

/**
 * Calculates 3D translation vectors for each organ moving outward from the common pivot.
 */
export function explodeOffsets(
  ids: Iterable<string>,
  centres: Map<string, THREE.Vector3>,
  factor: number,
): Map<string, THREE.Vector3> {
  const offsets = new Map<string, THREE.Vector3>();
  if (!Number.isFinite(factor) || factor <= 0) return offsets;

  const members = [...ids];
  const pivot = explodePivot(members, centres);
  if (!pivot) return offsets;

  for (const id of members) {
    const centre = centres.get(id);
    if (!centre) continue;
    const delta = centre.clone().sub(pivot).multiplyScalar(factor);
    if (delta.lengthSq() === 0) continue;
    offsets.set(id, delta);
  }

  return offsets;
}

import * as THREE from "three";

export const EXPLODE_STOPS = Object.freeze([0, 0.35, 0.9, 1.8] as const);
export const MAX_EXPLODE = 2;

export function nextExplodeStop(activeValue: number): number {
  for (let idx = 0; idx < EXPLODE_STOPS.length; idx++) {
    const candidate = EXPLODE_STOPS[idx]!;
    if (candidate > activeValue + 1e-6) {
      return candidate;
    }
  }
  return EXPLODE_STOPS[0];
}

export type ExplodeScope = "selection" | "region" | "everything";

export function explodeScope(viewerState: {
  selectedOrganIds: string[];
  isolatedOrganIds: string[] | null;
}): ExplodeScope {
  const { selectedOrganIds, isolatedOrganIds } = viewerState;
  if (selectedOrganIds.length >= 2) {
    return "selection";
  }
  if (isolatedOrganIds !== null && isolatedOrganIds.length >= 2) {
    return "region";
  }
  return "everything";
}

export function explodeMembers(
  viewerState: { selectedOrganIds: string[]; isolatedOrganIds: string[] | null },
  activeInventory: Iterable<string>
): string[] {
  const currentScope = explodeScope(viewerState);
  if (currentScope === "selection") {
    return viewerState.selectedOrganIds;
  }
  if (currentScope === "region") {
    return viewerState.isolatedOrganIds ?? [];
  }
  return Array.from(activeInventory);
}

export function explodePivot(
  targetIds: Iterable<string>,
  spatialCentres: Map<string, THREE.Vector3>
): THREE.Vector3 | null {
  const boundingRegion = new THREE.Box3();
  let validPointEncountered = false;

  for (const id of targetIds) {
    const point = spatialCentres.get(id);
    if (point) {
      boundingRegion.expandByPoint(point);
      validPointEncountered = true;
    }
  }

  if (!validPointEncountered) return null;
  const pivotResult = new THREE.Vector3();
  return boundingRegion.getCenter(pivotResult);
}

export function explodeOffsets(
  targetIds: Iterable<string>,
  spatialCentres: Map<string, THREE.Vector3>,
  magnitude: number
): Map<string, THREE.Vector3> {
  const offsetMap = new Map<string, THREE.Vector3>();
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    return offsetMap;
  }

  const idCollection = Array.from(targetIds);
  const anchorPivot = explodePivot(idCollection, spatialCentres);
  if (!anchorPivot) {
    return offsetMap;
  }

  for (const memberId of idCollection) {
    const origin = spatialCentres.get(memberId);
    if (!origin) continue;

    const displacement = origin.clone().sub(anchorPivot).multiplyScalar(magnitude);
    if (displacement.lengthSq() > 0) {
      offsetMap.set(memberId, displacement);
    }
  }

  return offsetMap;
}

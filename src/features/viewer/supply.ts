import * as THREE from "three";
import type { AnatomicalSystem } from "@/lib/schemas";

export type SupplyKind = "vascular" | "neural";

export const SUPPLY_SYSTEM: Record<SupplyKind, AnatomicalSystem> = Object.freeze({
  vascular: "cardiovascular",
  neural: "nervous",
});

export const SUPPLY_LABEL: Record<SupplyKind, string> = Object.freeze({
  vascular: "vessels",
  neural: "nerves",
});

export const REACH = 0.04;

export function studyEnvelope(
  targetOrganIds: Iterable<string>,
  spatialBoundingBoxes: Map<string, THREE.Box3>
): THREE.Box3 | null {
  const boundingVolume = new THREE.Box3();
  let hasValidGeometry = false;

  for (const organKey of targetOrganIds) {
    const organBox = spatialBoundingBoxes.get(organKey);
    if (organBox) {
      boundingVolume.union(organBox);
      hasValidGeometry = true;
    }
  }

  if (!hasValidGeometry) return null;

  const extents = new THREE.Vector3();
  boundingVolume.getSize(extents);
  const maxSpan = Math.max(extents.x, extents.y, extents.z);
  return boundingVolume.expandByScalar(maxSpan * REACH);
}

export function collectSupply(
  activeStudyIds: string[],
  supplyCandidateIds: Iterable<string>,
  spatialBoundingBoxes: Map<string, THREE.Box3>
): string[] {
  const envelope = studyEnvelope(activeStudyIds, spatialBoundingBoxes);
  if (!envelope) return [];

  const existingFilter = new Set<string>(activeStudyIds);
  const matchedStructures: string[] = [];

  for (const candidate of supplyCandidateIds) {
    if (existingFilter.has(candidate)) continue;
    const itemBox = spatialBoundingBoxes.get(candidate);
    if (itemBox && itemBox.intersectsBox(envelope)) {
      matchedStructures.push(candidate);
    }
  }

  return matchedStructures;
}

export function isSystemMeasured(
  supplyCandidateIds: Iterable<string>,
  spatialBoundingBoxes: Map<string, THREE.Box3>
): boolean {
  for (const id of supplyCandidateIds) {
    if (spatialBoundingBoxes.has(id)) return true;
  }
  return false;
}

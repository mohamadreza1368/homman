/**
 * Hoomaan 3D Viewer - Regional Vascular & Neural Supply Collector
 */

import * as THREE from "three";
import type { AnatomicalSystem } from "@/lib/schemas";

export type SupplyKind = "vascular" | "neural";

export const SUPPLY_SYSTEM: Record<SupplyKind, AnatomicalSystem> = {
  vascular: "cardiovascular",
  neural: "nervous",
};

export const SUPPLY_LABEL: Record<SupplyKind, string> = {
  vascular: "vessels",
  neural: "nerves",
};

/** Proportional expansion margin relative to set's bounding dimension. */
export const REACH = 0.04;

/** Computes bounding volume enclosing the active study set with reach margin. */
export function studyEnvelope(
  ids: Iterable<string>,
  boxes: Map<string, THREE.Box3>,
): THREE.Box3 | null {
  const envelope = new THREE.Box3();
  let measured = false;

  for (const id of ids) {
    const box = boxes.get(id);
    if (!box) continue;
    envelope.union(box);
    measured = true;
  }
  if (!measured) return null;

  const size = envelope.getSize(new THREE.Vector3());
  return envelope.expandByScalar(Math.max(size.x, size.y, size.z) * REACH);
}

/** Finds candidates from supply system that intersect the expanded study set volume. */
export function collectSupply(
  studyIds: string[],
  candidateIds: Iterable<string>,
  boxes: Map<string, THREE.Box3>,
): string[] {
  const envelope = studyEnvelope(studyIds, boxes);
  if (!envelope) return [];

  const existing = new Set(studyIds);
  const found: string[] = [];

  for (const id of candidateIds) {
    if (existing.has(id)) continue;
    const box = boxes.get(id);
    if (!box) continue;
    if (box.intersectsBox(envelope)) found.push(id);
  }

  return found;
}

/** Checks whether any candidate structures in the target system have measured geometry. */
export function isSystemMeasured(
  candidateIds: Iterable<string>,
  boxes: Map<string, THREE.Box3>,
): boolean {
  for (const id of candidateIds) {
    if (boxes.has(id)) return true;
  }
  return false;
}

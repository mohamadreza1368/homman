/**
 * Hoomaan 3D Viewer - Eyeball Anatomy & Gaze Tracking
 */

import * as THREE from "three";
import type { ManifestOrgan } from "@/lib/schemas";

const EYE_PARTS = [
  "sclera",
  "cornea",
  "iris",
  "lens",
  "retina",
  "vitreous_body",
  "zonular_fibres",
  "anterior_chamber_of_eyeball",
  "anterior_segment_of_eyeball",
  "posterior_segment_of_eyeball",
] as const;

const GLOBE = "sclera";
const FRONT = "cornea";

export type EyeSide = "l" | "r";

/** Extracts eye sub-part and lateral side ('l' | 'r') from organ identifier. */
export function eyePart(organId: string): { part: string; side: EyeSide } | null {
  for (const part of EYE_PARTS) {
    if (organId === `${part}_l`) return { part, side: "l" };
    if (organId === `${part}_r`) return { part, side: "r" };
  }
  return null;
}

/** Returns true if the given organ manifest entry is an intra-globe eye component. */
export function isEyePart(organ: ManifestOrgan): boolean {
  return eyePart(organ.organ_id) !== null;
}

export interface EyeGroup {
  side: EyeSide;
  centre: THREE.Vector3;
  restForward: THREE.Vector3;
  organs: ManifestOrgan[];
}

/** Groups eye structures by side, determining globe pivot and resting forward direction. */
export function buildEyeGroups(
  organs: ManifestOrgan[],
  centres: Map<string, THREE.Vector3>,
): EyeGroup[] {
  const sides = new Map<EyeSide, ManifestOrgan[]>();

  for (const organ of organs) {
    const match = eyePart(organ.organ_id);
    if (!match) continue;
    const group = sides.get(match.side) ?? [];
    group.push(organ);
    sides.set(match.side, group);
  }

  const result: EyeGroup[] = [];
  for (const [side, members] of sides) {
    const centre = centres.get(`${GLOBE}_${side}`);
    const front = centres.get(`${FRONT}_${side}`);
    if (!centre || !front) continue;

    const restForward = front.clone().sub(centre);
    if (restForward.lengthSq() < 1e-12) continue;

    result.push({
      side,
      centre: centre.clone(),
      restForward: restForward.normalize(),
      organs: members,
    });
  }

  return result.sort((a, b) => a.side.localeCompare(b.side));
}

/**
 * Clamps desired gaze vector to maximum anatomical angular rotation limit.
 */
export function clampGaze(
  rest: THREE.Vector3,
  target: THREE.Vector3,
  maxRadians: number,
): THREE.Vector3 {
  const desired = target.clone().normalize();
  const angle = rest.angleTo(desired);
  if (angle <= maxRadians) return desired;

  const axis = new THREE.Vector3().crossVectors(rest, desired);
  if (axis.lengthSq() < 1e-12) {
    axis.set(rest.y, -rest.x, 0);
    if (axis.lengthSq() < 1e-12) axis.set(0, rest.z, -rest.y);
  }

  return rest.clone().applyAxisAngle(axis.normalize(), maxRadians).normalize();
}

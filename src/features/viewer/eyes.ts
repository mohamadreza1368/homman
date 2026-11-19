import * as THREE from "three";
import type { ManifestOrgan } from "@/lib/schemas";

const INTRAOCULAR_COMPONENTS = new Set([
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
]);

const SCLERA_KEY = "sclera";
const CORNEA_KEY = "cornea";

export type EyeSide = "l" | "r";

export function eyePart(organId: string): { part: string; side: EyeSide } | null {
  const lastUnderscore = organId.lastIndexOf("_");
  if (lastUnderscore <= 0) return null;

  const sideChar = organId.slice(lastUnderscore + 1);
  if (sideChar !== "l" && sideChar !== "r") return null;

  const anatomicalStem = organId.slice(0, lastUnderscore);
  if (INTRAOCULAR_COMPONENTS.has(anatomicalStem)) {
    return { part: anatomicalStem, side: sideChar };
  }
  return null;
}

export function isEyePart(organ: ManifestOrgan): boolean {
  return eyePart(organ.organ_id) !== null;
}

export interface EyeGroup {
  side: EyeSide;
  centre: THREE.Vector3;
  restForward: THREE.Vector3;
  organs: ManifestOrgan[];
}

export function buildEyeGroups(
  organs: ManifestOrgan[],
  centres: Map<string, THREE.Vector3>
): EyeGroup[] {
  const groupedBySide: Record<EyeSide, ManifestOrgan[]> = { l: [], r: [] };

  for (const organ of organs) {
    const classification = eyePart(organ.organ_id);
    if (classification) {
      groupedBySide[classification.side].push(organ);
    }
  }

  const outputGroups: EyeGroup[] = [];
  const sidesList: EyeSide[] = ["l", "r"];

  for (const lateralSide of sidesList) {
    const sideMembers = groupedBySide[lateralSide];
    if (sideMembers.length === 0) continue;

    const scleraCentre = centres.get(`${SCLERA_KEY}_${lateralSide}`);
    const corneaCentre = centres.get(`${CORNEA_KEY}_${lateralSide}`);
    if (!scleraCentre || !corneaCentre) continue;

    const naturalGazeVector = corneaCentre.clone().sub(scleraCentre);
    if (naturalGazeVector.lengthSq() < 1e-12) continue;

    outputGroups.push({
      side: lateralSide,
      centre: scleraCentre.clone(),
      restForward: naturalGazeVector.normalize(),
      organs: sideMembers,
    });
  }

  return outputGroups.sort((first, second) => first.side.localeCompare(second.side));
}

export function clampGaze(
  restDirection: THREE.Vector3,
  intendedTarget: THREE.Vector3,
  maximumAngleRad: number
): THREE.Vector3 {
  const normalizedTarget = intendedTarget.clone().normalize();
  const angularSeparation = restDirection.angleTo(normalizedTarget);

  if (angularSeparation <= maximumAngleRad) {
    return normalizedTarget;
  }

  const rotationAxis = new THREE.Vector3().crossVectors(restDirection, normalizedTarget);
  if (rotationAxis.lengthSq() < 1e-12) {
    rotationAxis.set(restDirection.y, -restDirection.x, 0);
    if (rotationAxis.lengthSq() < 1e-12) {
      rotationAxis.set(0, restDirection.z, -restDirection.y);
    }
  }

  return restDirection
    .clone()
    .applyAxisAngle(rotationAxis.normalize(), maximumAngleRad)
    .normalize();
}

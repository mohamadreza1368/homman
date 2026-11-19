import * as THREE from "three";

/**
 * Standard anatomical orientations and viewpoint geometry calculations for HOOMAAN.
 *
 * Implements anatomical projections (anterior, posterior, left/right lateral, superior),
 * automated laterality sign detection based on paired mesh coordinates,
 * cinematic scanning angles, and keyboard zoom mapping.
 */
export type AnatomicalView =
  | "anterior"
  | "posterior"
  | "left"
  | "right"
  | "superior";

export const VIEW_LABEL: Record<AnatomicalView, string> = {
  anterior: "A",
  posterior: "P",
  left: "L",
  right: "R",
  superior: "S",
};

export const VIEW_HINT: Record<AnatomicalView, string> = {
  anterior: "Anterior — looking at the front",
  posterior: "Posterior — looking at the back",
  left: "Left lateral — the body's own left side",
  right: "Right lateral — the body's own right side",
  superior: "Superior — looking down from above",
};

export const VIEW_FOR_KEY: Record<string, AnatomicalView> = Object.fromEntries(
  (Object.keys(VIEW_LABEL) as AnatomicalView[]).map((view) => [
    VIEW_LABEL[view].toLowerCase(),
    view,
  ]),
);

export const FIT_KEY = "f";

export const VIEW_ORDER: AnatomicalView[] = [
  "anterior",
  "posterior",
  "left",
  "right",
  "superior",
];

/**
 * Determines whether the body's left side corresponds to +X or -X by evaluating
 * paired anatomical structures ending in `_l` and `_r`.
 */
export function lateralSign(
  organIds: Iterable<string>,
  centres: Map<string, THREE.Vector3>,
): 1 | -1 {
  let voteCount = 0;
  for (const id of organIds) {
    if (!id.endsWith("_l")) continue;
    const leftVec = centres.get(id);
    const rightVec = centres.get(`${id.slice(0, -2)}_r`);
    if (!leftVec || !rightVec) continue;
    if (leftVec.x > rightVec.x) voteCount++;
    else if (leftVec.x < rightVec.x) voteCount--;
  }
  return voteCount >= 0 ? 1 : -1;
}

/**
 * Computes unit direction vector for the camera given an anatomical view perspective.
 */
export function viewDirection(view: AnatomicalView, leftSign: 1 | -1): THREE.Vector3 {
  switch (view) {
    case "anterior":
      return new THREE.Vector3(0, 0, 1);
    case "posterior":
      return new THREE.Vector3(0, 0, -1);
    case "left":
      return new THREE.Vector3(leftSign, 0, 0);
    case "right":
      return new THREE.Vector3(-leftSign, 0, 0);
    case "superior":
      return new THREE.Vector3(0, 1, 0.001).normalize();
  }
}

const THREE_QUARTER_YAW = (32 * Math.PI) / 180;
const THREE_QUARTER_ELEVATION = 0.17;

export function scanStance(): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(THREE_QUARTER_YAW),
    THREE_QUARTER_ELEVATION,
    Math.cos(THREE_QUARTER_YAW),
  ).normalize();
}

export function framingDistance(radius: number, fovDegrees: number): number {
  return (Math.max(radius, 1e-4) * 2.2) / Math.tan((fovDegrees * Math.PI) / 360);
}

export const DOLLY_IN = 0.7;
export const DOLLY_OUT = 1 / DOLLY_IN;

export function zoomKeyFor(event: {
  key: string;
  code: string;
}): "in" | "out" | null {
  if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
    return "in";
  }
  if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") {
    return "out";
  }
  return null;
}

import * as THREE from "three";

export type AnatomicalView =
  | "anterior"
  | "posterior"
  | "left"
  | "right"
  | "superior";

export const VIEW_LABEL: Record<AnatomicalView, string> = Object.freeze({
  anterior: "A",
  posterior: "P",
  left: "L",
  right: "R",
  superior: "S",
});

export const VIEW_HINT: Record<AnatomicalView, string> = Object.freeze({
  anterior: "Anterior — looking at the front",
  posterior: "Posterior — looking at the back",
  left: "Left lateral — the body's own left side",
  right: "Right lateral — the body's own right side",
  superior: "Superior — looking down from above",
});

export const VIEW_ORDER: readonly AnatomicalView[] = Object.freeze([
  "anterior",
  "posterior",
  "left",
  "right",
  "superior",
]);

export const VIEW_FOR_KEY: Record<string, AnatomicalView> = Object.freeze(
  VIEW_ORDER.reduce<Record<string, AnatomicalView>>((acc, viewKey) => {
    acc[VIEW_LABEL[viewKey].toLowerCase()] = viewKey;
    return acc;
  }, {})
);

export const FIT_KEY = "f";

export function lateralSign(
  organKeys: Iterable<string>,
  spatialCentres: Map<string, THREE.Vector3>
): 1 | -1 {
  let parityBalance = 0;

  for (const organId of organKeys) {
    if (!organId.endsWith("_l")) continue;
    const leftPos = spatialCentres.get(organId);
    const counterpartId = `${organId.slice(0, -2)}_r`;
    const rightPos = spatialCentres.get(counterpartId);

    if (leftPos && rightPos) {
      if (leftPos.x > rightPos.x) {
        parityBalance += 1;
      } else if (leftPos.x < rightPos.x) {
        parityBalance -= 1;
      }
    }
  }

  return parityBalance >= 0 ? 1 : -1;
}

export function viewDirection(view: AnatomicalView, leftSign: 1 | -1): THREE.Vector3 {
  if (view === "anterior") {
    return new THREE.Vector3(0, 0, 1);
  }
  if (view === "posterior") {
    return new THREE.Vector3(0, 0, -1);
  }
  if (view === "left") {
    return new THREE.Vector3(leftSign, 0, 0);
  }
  if (view === "right") {
    return new THREE.Vector3(-leftSign, 0, 0);
  }
  return new THREE.Vector3(0, 1, 0.001).normalize();
}

const CINEMATIC_YAW_RAD = (32 * Math.PI) / 180;
const CINEMATIC_PITCH = 0.17;

export function scanStance(): THREE.Vector3 {
  const horizontalX = Math.sin(CINEMATIC_YAW_RAD);
  const horizontalZ = Math.cos(CINEMATIC_YAW_RAD);
  return new THREE.Vector3(horizontalX, CINEMATIC_PITCH, horizontalZ).normalize();
}

export function framingDistance(boundingRadius: number, verticalFovDegrees: number): number {
  const clampedRadius = Math.max(boundingRadius, 1e-4);
  const halfAngleRad = (verticalFovDegrees * Math.PI) / 360;
  return (clampedRadius * 2.2) / Math.tan(halfAngleRad);
}

export const DOLLY_IN = 0.7;
export const DOLLY_OUT = 1 / DOLLY_IN;

export function zoomKeyFor(keyEvent: {
  key: string;
  code: string;
}): "in" | "out" | null {
  const { key, code } = keyEvent;
  if (key === "+" || key === "=" || code === "NumpadAdd") {
    return "in";
  }
  if (key === "-" || key === "_" || code === "NumpadSubtract") {
    return "out";
  }
  return null;
}

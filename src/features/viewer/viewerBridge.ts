/**
 * Hoomaan 3D Viewer - Viewport Handle Bridge & Screen Projection
 */

import * as THREE from "three";

export interface ViewerHandle {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  centres: Map<string, THREE.Vector3>;
  offsets: Map<string, THREE.Vector3>;
  controls: { enabled: boolean } | null;
  geometryRevision?: number;
}

let activeHandle: ViewerHandle | null = null;

/** Registers or clears global viewer handle reference. */
export function setViewerHandle(next: ViewerHandle | null): void {
  activeHandle = next;
}

/** Retrieves the currently active viewer handle instance. */
export function getViewerHandle(): ViewerHandle | null {
  return activeHandle;
}

/** Resolves current 3D position of an organ, including exploded offsets if present. */
export function structurePosition(
  handle: Pick<ViewerHandle, "centres" | "offsets">,
  organId: string,
): THREE.Vector3 | undefined {
  const centre = handle.centres.get(organId);
  if (!centre) return undefined;
  const offset = handle.offsets.get(organId);
  return offset ? centre.clone().add(offset) : centre;
}

/** Provides indexed position lookup interface conforming to spatial collectors. */
export function positionLookup(
  handle: Pick<ViewerHandle, "centres" | "offsets">,
): { get(organId: string): THREE.Vector3 | undefined } {
  return { get: (organId) => structurePosition(handle, organId) };
}

export interface ScreenPoint {
  x: number;
  y: number;
  behind: boolean;
}

const tmpVec = new THREE.Vector3();

/** Projects 3D world coordinate vector into 2D viewport screen coordinates. */
export function projectToScreen(
  point: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
): ScreenPoint {
  camera.updateMatrixWorld(true);
  tmpVec.copy(point).applyMatrix4(camera.matrixWorldInverse);
  const behind = tmpVec.z > 0;
  tmpVec.applyMatrix4(camera.projectionMatrix);

  return {
    x: (tmpVec.x * 0.5 + 0.5) * width,
    y: (-tmpVec.y * 0.5 + 0.5) * height,
    behind,
  };
}

import * as THREE from "three";

export interface CameraRigMetrics {
  height: number;
  bottom: number;
}

export function computeHologramCameraTarget(
  camera: THREE.PerspectiveCamera,
  metrics: CameraRigMetrics,
  stageY: number,
  activeZoomTarget: number,
  organBoundingBoxes: THREE.Box3[],
  unionBoundingBox: THREE.Box3 | null,
  orbitAzimuth: number,
): { target: THREE.Vector3; distance: number } {
  const halfFovRad = THREE.MathUtils.degToRad(camera.fov) * 0.5;
  const vSpan = (metrics.height + 0.55) * 0.5;
  const hSpan = (1.8 * 0.4) / Math.max(0.2, camera.aspect);
  const baseDistance = Math.max(vSpan, hSpan) / Math.tan(halfFovRad);

  const focusPoint = new THREE.Vector3(
    0,
    stageY + metrics.bottom + metrics.height * 0.5 - 0.12,
    0,
  );
  let distance = baseDistance;

  const targetBox =
    activeZoomTarget >= 0
      ? organBoundingBoxes[activeZoomTarget]
      : activeZoomTarget === -1
        ? unionBoundingBox
        : null;

  if (targetBox && !targetBox.isEmpty()) {
    const boxExtent = targetBox.getSize(new THREE.Vector3());
    const boxCenter = targetBox.getCenter(new THREE.Vector3());

    const worldBoxCenter = boxCenter.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitAzimuth);
    worldBoxCenter.y += stageY;
    focusPoint.copy(worldBoxCenter);

    const rad = Math.max(boxExtent.x, boxExtent.y, boxExtent.z) * 0.7;
    distance = Math.max(0.35, Math.min(baseDistance, (rad / Math.tan(halfFovRad)) * 1.3));
  }

  return { target: focusPoint, distance };
}

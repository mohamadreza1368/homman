/**
 * Hoomaan 3D Viewer - Viewport Frame Capture Helper
 */

import * as THREE from "three";
import type { ViewerHandle } from "./viewerBridge";

/**
 * Renders the primary scene using an isolated camera clone, passing it to consumer before presentation.
 */
export function captureView<T>(handle: ViewerHandle, consume: (camera: THREE.Camera) => T): T {
  const { gl, scene, camera } = handle;

  const prevViewport = gl.getViewport(new THREE.Vector4());
  const prevScissor = gl.getScissor(new THREE.Vector4());
  const prevScissorTest = gl.getScissorTest();
  const prevTarget = gl.getRenderTarget();
  const prevFace = gl.getActiveCubeFace();
  const prevLevel = gl.getActiveMipmapLevel();
  const prevAutoClear = gl.autoClear;

  const canvasSize = gl.getSize(new THREE.Vector2());

  camera.updateWorldMatrix(true, false);
  const clonedCamera = camera.clone();
  camera.matrixWorld.decompose(clonedCamera.position, clonedCamera.quaternion, clonedCamera.scale);

  if (clonedCamera instanceof THREE.PerspectiveCamera) {
    clonedCamera.aspect = gl.domElement.width / gl.domElement.height;
    clonedCamera.updateProjectionMatrix();
  }
  clonedCamera.updateMatrixWorld(true);

  try {
    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, canvasSize.x, canvasSize.y);
    gl.autoClear = true;
    gl.render(scene, clonedCamera);
    return consume(clonedCamera);
  } finally {
    gl.setRenderTarget(prevTarget, prevFace, prevLevel);
    gl.setViewport(prevViewport);
    gl.setScissor(prevScissor);
    gl.setScissorTest(prevScissorTest);
    gl.autoClear = prevAutoClear;
  }
}

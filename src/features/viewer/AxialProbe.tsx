import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { SHARED_SCAN } from "./scanBand";
import type { SectionPlaneName, SliceBasis, SlicePlane, SliceWindow } from "./axialSlice";
import { useScanStore } from "@/stores/scanStore";
import {
  AXIAL_CANVAS,
  cameraForwardOf,
  cameraUpOf,
  cutPlanes,
  paintSlice,
  planePoint,
  sliceBasis,
  sliceWindowOf,
  slabPlanes,
  SLAB_HALF_THICKNESS,
  SECTION_VIEW,
  SLICE_PIXELS,
  sliceSize,
  TORCH,
} from "./axialSlice";
import { aimStudioAt, rakingKey } from "./lighting";

/**
 * HOOMAAN Off-screen Axial & Cross-Section Render Probe.
 * Renders high-fidelity orthographic cross-sections of anatomical geometry
 * into an off-screen target with dynamic lighting and bounds-based culling.
 */

export const AXIAL_PROBE = {
  renderMs: -1,
  readbackMs: -1,
  drawCalls: -1,
  runs: 0,
  drawn: -1,
  frameCm: -1,
  base: { h: 0, v: 0, half: 0 } as SliceWindow,
  shown: { h: 0, v: 0, half: 0 } as SliceWindow,
  basis: sliceBasis(1) as SliceBasis,
  at: 0,
  plane: "axial" as SectionPlaneName,
};

export function AxialProbe({
  bounds,
  request,
  high,
  leftSign,
  plane,
}: {
  bounds: THREE.Box3 | null;
  request: number;
  high: boolean;
  leftSign: 1 | -1;
  plane: SlicePlane;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const lastProcessedRequest = useRef(0);

  const textureDim = sliceSize(high, gl.capabilities.maxTextureSize);
  useEffect(() => {
    SLICE_PIXELS.value = textureDim;
  }, [textureDim]);

  const renderTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(textureDim, textureDim, {
        depthBuffer: true,
        stencilBuffer: false,
      }),
    [textureDim],
  );
  useEffect(() => () => renderTarget.dispose(), [renderTarget]);

  const orthoCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 2), []);
  const pixelBuffer = useMemo(() => new Uint8Array(textureDim * textureDim * 4), [textureDim]);
  const hiddenMeshCache = useRef<THREE.Mesh[]>([]);
  const materialStateCache = useRef<
    { material: THREE.Material; transparent: boolean; opacity: number; depthWrite: boolean }[]
  >([]);
  const tempBox = useMemo(() => new THREE.Box3(), []);
  const contentBounds = useMemo(() => new THREE.Box3(), []);

  useFrame(() => {
    if (request === lastProcessedRequest.current || !bounds || bounds.isEmpty()) return;
    lastProcessedRequest.current = request;

    const currentScanLevel = SHARED_SCAN.value;

    const scanRingObj = scene.getObjectByName("scan-ring");
    const scanRingInitialVisibility = scanRingObj?.visible ?? false;
    if (scanRingObj) scanRingObj.visible = false;

    const hiddenMeshes = hiddenMeshCache.current;
    const restoredMaterials = materialStateCache.current;
    hiddenMeshes.length = 0;
    restoredMaterials.length = 0;

    let candidateCount = 0;
    contentBounds.makeEmpty();

    scene.traverseVisible((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      candidateCount += 1;

      const geo = mesh.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingBox) return;

      tempBox.copy(geo.boundingBox).applyMatrix4(mesh.matrixWorld);
      const minDot = tempBox.min.dot(plane.normal);
      const maxDot = tempBox.max.dot(plane.normal);

      if (maxDot < currentScanLevel - SLAB_HALF_THICKNESS || minDot > currentScanLevel + SLAB_HALF_THICKNESS) {
        mesh.visible = false;
        hiddenMeshes.push(mesh);
        return;
      }

      contentBounds.union(tempBox);

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        restoredMaterials.push({
          material: m,
          transparent: m.transparent,
          opacity: m.opacity,
          depthWrite: m.depthWrite,
        });
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
      }
    });

    const baseWindow: SliceWindow = sliceWindowOf(contentBounds.isEmpty() ? bounds : contentBounds, plane);
    const activeWindow = SECTION_VIEW.value ?? baseWindow;

    orthoCam.left = -activeWindow.half;
    orthoCam.right = activeWindow.half;
    orthoCam.top = activeWindow.half;
    orthoCam.bottom = -activeWindow.half;

    const centerPoint = planePoint(plane, activeWindow.h, activeWindow.v, currentScanLevel);
    orthoCam.position.copy(centerPoint).addScaledVector(plane.normal, 0.5);
    orthoCam.up.copy(cameraUpOf(plane));
    orthoCam.lookAt(centerPoint);
    orthoCam.updateProjectionMatrix();

    AXIAL_PROBE.frameCm = activeWindow.half * 200;
    AXIAL_PROBE.base = baseWindow;
    AXIAL_PROBE.shown = activeWindow;

    const priorClipping = gl.clippingPlanes;
    const priorRenderTarget = gl.getRenderTarget();

    const torchDir = TORCH.value;
    const isCutMode = useScanStore.getState().cut;
    const camFwd = cameraForwardOf(plane);
    const camUp = cameraUpOf(plane);

    const resetLights = aimStudioAt(scene, camFwd, camUp, {
      key: torchDir ?? (isCutMode ? undefined : rakingKey(camFwd, camUp)),
      support: torchDir ? 0.35 : 1,
    });

    try {
      gl.clippingPlanes = isCutMode ? cutPlanes(plane, currentScanLevel) : slabPlanes(plane, currentScanLevel);
      gl.info.reset();

      const tStartRender = performance.now();
      gl.setRenderTarget(renderTarget);
      gl.render(scene, orthoCam);
      gl.getContext().finish();
      AXIAL_PROBE.renderMs = performance.now() - tStartRender;
      AXIAL_PROBE.drawCalls = gl.info.render.calls;

      const tStartReadback = performance.now();
      gl.readRenderTargetPixels(renderTarget, 0, 0, textureDim, textureDim, pixelBuffer);
      AXIAL_PROBE.readbackMs = performance.now() - tStartReadback;
    } finally {
      resetLights();
      gl.setRenderTarget(priorRenderTarget);
      gl.clippingPlanes = priorClipping;

      if (scanRingObj) scanRingObj.visible = scanRingInitialVisibility;
      for (const mesh of hiddenMeshes) mesh.visible = true;
      for (const state of restoredMaterials) {
        state.material.transparent = state.transparent;
        state.material.opacity = state.opacity;
        state.material.depthWrite = state.depthWrite;
        state.material.needsUpdate = true;
      }
      restoredMaterials.length = 0;
    }

    AXIAL_PROBE.drawn = candidateCount - hiddenMeshes.length;
    hiddenMeshes.length = 0;
    AXIAL_PROBE.runs += 1;

    const canvasElem = AXIAL_CANVAS.value;
    const activeBasis = sliceBasis(leftSign);
    AXIAL_PROBE.basis = activeBasis;
    AXIAL_PROBE.at = currentScanLevel;
    AXIAL_PROBE.plane = plane.name;

    if (canvasElem) {
      paintSlice(canvasElem, pixelBuffer, textureDim, activeBasis, plane);
    }

    useScanStore.getState().sectionTaken();
  });

  return null;
}

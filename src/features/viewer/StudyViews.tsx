import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { lateralSign, viewDirection, type AnatomicalView } from "./cameraViews";
import { useSceneStore } from "@/stores/sceneStore";
import { useStudyViewsStore } from "@/stores/studyViewsStore";
import { domRect, MAIN, mainRect, panelLayout, type PanelRect } from "./studyLayout";
import { getViewerHandle } from "./viewerBridge";

/**
 * HOOMAAN Multi-Angle Study Views Viewport Manager.
 * Executes synchronized scissored sub-viewport rendering across four orthogonal
 * viewpoints (driven perspective, anterior, left lateral, superior) within a single WebGL canvas.
 */

function fullCanvasCompute(
  event: { offsetX: number; offsetY: number },
  state: {
    pointer: THREE.Vector2;
    raycaster: THREE.Raycaster;
    camera: THREE.Camera;
    size: { width: number; height: number };
  },
): void {
  state.pointer.set(
    (event.offsetX / state.size.width) * 2 - 1,
    -(event.offsetY / state.size.height) * 2 + 1,
  );
  state.raycaster.setFromCamera(state.pointer, state.camera);
  state.raycaster.far = Infinity;
}

function quadrantCompute(
  event: { offsetX: number; offsetY: number },
  state: {
    pointer: THREE.Vector2;
    raycaster: THREE.Raycaster;
    camera: THREE.Camera;
    size: { width: number; height: number };
  },
): void {
  const panel = domRect(mainRect(useStudyViewsStore.getState().active));
  const box = {
    left: panel.left * state.size.width,
    top: panel.top * state.size.height,
    width: panel.width * state.size.width,
    height: panel.height * state.size.height,
  };
  const x = event.offsetX - box.left;
  const y = event.offsetY - box.top;
  const isInside = x >= 0 && y >= 0 && x < box.width && y < box.height;

  state.pointer.set((x / box.width) * 2 - 1, -(y / box.height) * 2 + 1);
  state.raycaster.setFromCamera(state.pointer, state.camera);
  state.raycaster.far = isInside ? Infinity : -1;
}

export function PointerRouting({ splitting }: { splitting: boolean }) {
  const setEvents = useThree((state) => state.setEvents);

  useEffect(() => {
    setEvents({ compute: splitting ? quadrantCompute : fullCanvasCompute });
  }, [splitting, setEvents]);

  return null;
}

function matchAspect(camera: THREE.Camera, aspect: number): void {
  const perspective = camera as THREE.PerspectiveCamera;
  if (!perspective.isPerspectiveCamera) return;
  if (Math.abs(perspective.aspect - aspect) < 1e-6) return;
  perspective.aspect = aspect;
  perspective.updateProjectionMatrix();
}

const AUXILIARY_VIEWS: AnatomicalView[] = ["anterior", "left", "superior"];
const MIN_HEADROOM_RATIO = 1.15;
const REFRAME_INTERVAL_MS = 400;

function focusBounds(scene: THREE.Scene): THREE.Box3 | null {
  const { selectedOrganIds, illuminated } = useSceneStore.getState();

  for (const group of [selectedOrganIds, illuminated, null]) {
    const filterSet = group && group.length > 0 ? new Set(group) : null;
    if (group !== null && filterSet === null) continue;

    const b = computeFilteredBounds(scene, filterSet);
    if (b) return b;
  }

  return null;
}

function computeFilteredBounds(scene: THREE.Scene, allowedIds: Set<string> | null): THREE.Box3 | null {
  const totalBox = new THREE.Box3();
  const tempBox = new THREE.Box3();
  let hasValidMeshes = false;

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
    if (allowedIds && !allowedIds.has(String(mesh.userData.organId))) return;

    tempBox.setFromObject(mesh);
    if (tempBox.isEmpty()) return;
    totalBox.union(tempBox);
    hasValidMeshes = true;
  });

  return hasValidMeshes ? totalBox : null;
}

export function StudyViews() {
  const gl = useThree((state) => state.gl);
  const mainCamera = useThree((state) => state.camera);
  const canvasSize = useThree((state) => state.size);
  const activeViews = useStudyViewsStore((state) => state.active);

  const orthographicCams = useMemo(
    () =>
      Object.fromEntries(
        AUXILIARY_VIEWS.map((view) => [
          view,
          new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200),
        ]),
      ) as Record<AnatomicalView, THREE.OrthographicCamera>,
    [],
  );

  const lastReframeTime = useRef(-Infinity);
  const cachedBoundsRef = useRef<THREE.Box3 | null>(null);
  const lastObservedState = useRef<ReturnType<typeof useSceneStore.getState> | null>(null);
  const lastGeometryRevision = useRef<number | undefined>(undefined);
  const currentLayoutContext = useMemo(
    () => ({ active: activeViews, width: canvasSize.width, height: canvasSize.height }),
    [activeViews, canvasSize.width, canvasSize.height],
  );
  const lastLayoutContext = useRef<typeof currentLayoutContext | null>(null);

  useEffect(() => {
    gl.info.autoReset = false;

    return () => {
      gl.info.autoReset = true;
      gl.setScissorTest(false);
      gl.setViewport(0, 0, canvasSize.width, canvasSize.height);
      gl.setScissor(0, 0, canvasSize.width, canvasSize.height);
      matchAspect(mainCamera, canvasSize.width / canvasSize.height);
    };
  }, [gl, mainCamera, canvasSize.width, canvasSize.height]);

  useFrame(({ gl: renderer, scene: graphScene, camera }) => {
    renderer.info.reset();

    const panels = panelLayout(activeViews);
    const bounds = updateAuxiliaryFraming(graphScene, camera, panels);
    if (!bounds) {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, canvasSize.width, canvasSize.height);
      matchAspect(camera, canvasSize.width / canvasSize.height);
      renderer.render(graphScene, camera);
      return;
    }

    renderer.setScissorTest(true);

    for (const p of panels) {
      const px = p.x * canvasSize.width;
      const py = p.y * canvasSize.height;
      const pw = p.width * canvasSize.width;
      const ph = p.height * canvasSize.height;

      renderer.setViewport(px, py, pw, ph);
      renderer.setScissor(px, py, pw, ph);

      if (p.id === MAIN) matchAspect(camera, pw / ph);
      renderer.render(graphScene, p.id === MAIN ? camera : orthographicCams[p.id]);
    }

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, canvasSize.width, canvasSize.height);
    renderer.setScissor(0, 0, canvasSize.width, canvasSize.height);
  }, 1);

  function updateAuxiliaryFraming(
    sceneGraph: THREE.Scene,
    primaryCam: THREE.Camera,
    panels: PanelRect[],
  ): THREE.Box3 | null {
    const now = performance.now();
    const currentState = useSceneStore.getState();
    const previous = lastObservedState.current;
    const rev = getViewerHandle()?.geometryRevision;

    const hasStateChanged =
      previous === null ||
      previous.selectedOrganIds !== currentState.selectedOrganIds ||
      previous.illuminated !== currentState.illuminated ||
      previous.isolatedOrganIds !== currentState.isolatedOrganIds ||
      previous.hiddenSystems !== currentState.hiddenSystems ||
      previous.organs !== currentState.organs ||
      lastGeometryRevision.current !== rev ||
      lastLayoutContext.current !== currentLayoutContext;

    if (!hasStateChanged && now - lastReframeTime.current < REFRAME_INTERVAL_MS) {
      return cachedBoundsRef.current;
    }

    lastReframeTime.current = now;
    lastObservedState.current = currentState;
    lastGeometryRevision.current = rev;
    lastLayoutContext.current = currentLayoutContext;

    const bounds = focusBounds(sceneGraph);
    cachedBoundsRef.current = bounds;
    if (!bounds) return null;

    const centerPoint = bounds.getCenter(new THREE.Vector3());
    const boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    const safeRadius = Math.max(boundingSphere.radius, 1e-4);
    const aspectCanvas = canvasSize.width / canvasSize.height;

    const perspectiveCam = primaryCam as THREE.PerspectiveCamera;
    const fovDegrees = typeof perspectiveCam.fov === "number" ? perspectiveCam.fov : 45;
    const distanceMatched =
      primaryCam.position.distanceTo(centerPoint) * Math.tan((fovDegrees * Math.PI) / 360);
    const sceneSpan = Math.max(distanceMatched, safeRadius * MIN_HEADROOM_RATIO);

    const viewerHandle = getViewerHandle();
    const lateralOrientation = viewerHandle
      ? lateralSign(viewerHandle.centres.keys(), viewerHandle.centres)
      : 1;

    for (const view of AUXILIARY_VIEWS) {
      const ortho = orthographicCams[view];
      const matchingPanel = panels.find((p) => p.id === view);
      const panelAspect = matchingPanel
        ? (matchingPanel.width * canvasSize.width) / (matchingPanel.height * canvasSize.height)
        : aspectCanvas;

      ortho.left = -sceneSpan * panelAspect;
      ortho.right = sceneSpan * panelAspect;
      ortho.top = sceneSpan;
      ortho.bottom = -sceneSpan;
      ortho.near = 0.01;
      ortho.far = safeRadius * 20 + 10;

      ortho.up.set(0, view === "superior" ? 0 : 1, view === "superior" ? 1 : 0);
      ortho.position
        .copy(centerPoint)
        .add(viewDirection(view, lateralOrientation).multiplyScalar(safeRadius * 4 + 1));
      ortho.lookAt(centerPoint);
      ortho.updateProjectionMatrix();
      ortho.updateMatrixWorld();
    }

    return bounds;
  }

  return null;
}

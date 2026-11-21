import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { acquireDraco, loadBrain, releaseDraco, worldGeometry, type Brain, type BrainStructure } from "./brainLoader";
import { projector } from "./environment";
import { brainMaterial, brainPoints, RegionLight } from "./hologram";
import { organMaterial } from "./bodyHologramMaterial";
import type { SceneLayer } from "./memoryScene";

export interface BodyHologramOptions {
  meshUrl: string;
  structures: readonly BrainStructure[];
  dracoPath: string;
  reducedMotion?: boolean;
  host: { addLayer(layer: SceneLayer): () => void };
  frame: HTMLElement;
  fileUrl: (file: string) => string;
  onError?: (error: unknown) => void;
}

export interface OrganRef {
  id: string;
  node: string;
  file: string;
}

export interface BodyHologram {
  setPresence(level: number): void;
  show(organs: readonly OrganRef[]): Promise<string[]>;
  pick(id: string | null): void;
  zoom(on: boolean, id?: string | null): void;
  skipIntro(): void;
  dispose(): void;
}

const STAGES = { boot: 1.1, deploy: 2.4, materialize: 1.4 } as const;
const SCAN_DURATION_SEC = 1.8;
const FIGURE_OPACITY_GAIN = 2.6;
const PROJECTOR_PAD_SCALE = 0.4;
const ORGAN_FADE_IN_SEC = 0.9;
const STRUCTURE_PICK_RATE = 0.15;
const CAMERA_ZOOM_EASE = 0.07;
const ZOOM_OCCUPANCY_RATIO = 2.4;
const ZOOM_MIN_SPAN = 0.035;
const VERTICAL_AXIS = new THREE.Vector3(0, 1, 0);
const VERTICAL_VIEW_OFFSET = 0.16;

const cubicEase = (v: number) => {
  const clamped = Math.min(1, Math.max(0, v));
  return clamped * clamped * (3 - 2 * clamped);
};

export function createBodyHologram(container: HTMLElement, config: BodyHologramOptions): BodyHologram {
  const isReducedMotion =
    config.reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const sceneGraph = new THREE.Scene();
  const perspectiveCam = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

  const floorPad = projector();
  floorPad.scale.setScalar(PROJECTOR_PAD_SCALE);

  const pivotGroup = new THREE.Group();
  sceneGraph.add(floorPad, pivotGroup);

  let avatarModel: Brain | null = null;
  let skinMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let particleDust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let lightingProfile: RegionLight | null = null;

  let startEpochSec: number | null = null;
  let timeSkipOffset = 0;
  let targetPresence = 1;
  let currentVisibility = 1;
  let scanStartEpoch = -100;
  let currentAzimuth = 0;
  let isDisposed = false;

  const targetDustCount = isReducedMotion ? 4000 : 9000;
  let highlightedOrgansMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let highlightTimestamp = 0;
  let activeOrganIds: string[] = [];

  let selectedOrganIndex = -1;
  let previousOrganIndex = -1;
  let organFocusProgress = 0;

  let organBoundingBoxes: THREE.Box3[] = [];
  let collectiveBounds: THREE.Box3 | null = null;
  let activeZoomTarget = -2; // -2: whole body, -1: all organs, >=0: specific organ

  const cameraState = { target: new THREE.Vector3(), distance: 1, initialized: false };
  const targetLookAt = new THREE.Vector3();
  const boxDimension = new THREE.Vector3();

  let activeRequestId = 0;
  let initializationPromise: Promise<void> = Promise.resolve();

  const assetLoader = new GLTFLoader().setDRACOLoader(acquireDraco(config.dracoPath));
  const cachedFileHierarchy = new Map<string, Promise<Map<string, THREE.Object3D>>>();

  const getFileNodes = (fileName: string) => {
    let pendingNodes = cachedFileHierarchy.get(fileName);
    if (!pendingNodes) {
      pendingNodes = assetLoader.loadAsync(config.fileUrl(fileName)).then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const nodeIndex = new Map<string, THREE.Object3D>();
        gltf.scene.traverse((n) => nodeIndex.set(n.name, n));
        return nodeIndex;
      });
      pendingNodes.catch(() => cachedFileHierarchy.delete(fileName));
      cachedFileHierarchy.set(fileName, pendingNodes);
    }
    return pendingNodes;
  };

  const anatomicalDimensions = { height: 2, bottom: -1 };

  initializationPromise = (async () => {
    try {
      const loadedAvatar = await loadBrain({
        meshUrl: config.meshUrl,
        structures: config.structures,
        dracoPath: config.dracoPath,
      });

      if (isDisposed) {
        loadedAvatar.geometry.dispose();
        return;
      }

      avatarModel = loadedAvatar;
      anatomicalDimensions.height = avatarModel.top - avatarModel.bottom;
      anatomicalDimensions.bottom = avatarModel.bottom;

      lightingProfile = new RegionLight(avatarModel.regions.length);
      skinMesh = new THREE.Mesh(avatarModel.geometry, brainMaterial(lightingProfile));

      particleDust = brainPoints(avatarModel.geometry, targetDustCount, 11);
      particleDust.material.uniforms.uRegions!.value = lightingProfile.texture;
      particleDust.material.uniforms.uRegionCount!.value = lightingProfile.size;

      pivotGroup.add(skinMesh, particleDust);
      pivotGroup.position.y = -1.55 * PROJECTOR_PAD_SCALE - avatarModel.bottom + 0.02;
      floorPad.position.y = -1.55 * PROJECTOR_PAD_SCALE;

      startEpochSec = performance.now() / 1000;
    } catch (err) {
      config.onError?.(err);
    }
  })();

  const clearLitGeometry = () => {
    if (!highlightedOrgansMesh) return;
    pivotGroup.remove(highlightedOrgansMesh);
    highlightedOrgansMesh.geometry.dispose();
    highlightedOrgansMesh.material.dispose();
    highlightedOrgansMesh = null;
    activeOrganIds = [];
    selectedOrganIndex = -1;
    previousOrganIndex = -1;
    organFocusProgress = 0;
    organBoundingBoxes = [];
    collectiveBounds = null;
    activeZoomTarget = -2;
  };

  // Pointer drag interaction
  let pointerDragAnchor: { startX: number; baseSpin: number } | null = null;
  container.style.cursor = "grab";

  const handlePointerDown = (evt: PointerEvent) => {
    if ((evt.target as Element | null)?.closest?.("button")) return;
    evt.preventDefault();
    pointerDragAnchor = { startX: evt.clientX, baseSpin: currentAzimuth };
    container.setPointerCapture(evt.pointerId);
    container.style.cursor = "grabbing";
  };

  const handlePointerMove = (evt: PointerEvent) => {
    if (pointerDragAnchor) {
      currentAzimuth = pointerDragAnchor.baseSpin + (evt.clientX - pointerDragAnchor.startX) * 0.008;
    }
  };

  const handlePointerUp = () => {
    pointerDragAnchor = null;
    container.style.cursor = "grab";
  };

  container.addEventListener("pointerdown", handlePointerDown);
  container.addEventListener("pointermove", handlePointerMove);
  container.addEventListener("pointerup", handlePointerUp);
  container.addEventListener("pointercancel", handlePointerUp);

  const getRunningTime = () =>
    startEpochSec === null ? 0 : performance.now() / 1000 - startEpochSec + timeSkipOffset;

  const renderFrameUpdate = (
    currentTimeSec: number,
    aspectRatio: number,
    screenPixelRatio: number,
    particleWeight: number,
  ) => {
    perspectiveCam.aspect = aspectRatio;
    perspectiveCam.updateProjectionMatrix();

    const t = getRunningTime();
    const bootStage = cubicEase(t / STAGES.boot);
    const deployStage = cubicEase((t - STAGES.boot) / STAGES.deploy);
    const materializationStage = cubicEase((t - STAGES.boot - STAGES.deploy) / STAGES.materialize);

    currentVisibility += (targetPresence - currentVisibility) * 0.08;

    const motionScale = isReducedMotion ? 0.35 : 1.0;
    if (!pointerDragAnchor && activeZoomTarget === -2) {
      currentAzimuth += 0.0025 * motionScale;
    }
    pivotGroup.rotation.y = currentAzimuth;

    const halfVertFov = THREE.MathUtils.degToRad(perspectiveCam.fov) * 0.5;
    const verticalSpan = (anatomicalDimensions.height + 0.55) * 0.5;
    const horizontalSpan = (1.8 * PROJECTOR_PAD_SCALE) / Math.max(0.2, perspectiveCam.aspect);
    const baselineDistance = Math.max(verticalSpan, horizontalSpan) / Math.tan(halfVertFov);

    let optimalCamDistance = baselineDistance;
    targetLookAt.set(
      0,
      pivotGroup.position.y + anatomicalDimensions.bottom + anatomicalDimensions.height * 0.5 - 0.12,
      0,
    );

    const activeBounds =
      activeZoomTarget >= 0
        ? organBoundingBoxes[activeZoomTarget]
        : activeZoomTarget === -1
          ? collectiveBounds
          : null;

    if (activeBounds) {
      const organSpanRadius = Math.max(ZOOM_MIN_SPAN, activeBounds.getSize(boxDimension).length() * 0.5);
      activeBounds.getCenter(targetLookAt).applyAxisAngle(VERTICAL_AXIS, currentAzimuth).add(pivotGroup.position);
      const viewportTangent = Math.tan(halfVertFov) * Math.min(1, perspectiveCam.aspect);
      optimalCamDistance = Math.min(optimalCamDistance, (organSpanRadius * ZOOM_OCCUPANCY_RATIO) / viewportTangent);
    }

    const cameraLerpSpeed = cameraState.initialized && !isReducedMotion ? CAMERA_ZOOM_EASE : 1.0;
    cameraState.target.lerp(targetLookAt, cameraLerpSpeed);
    cameraState.distance += (optimalCamDistance - cameraState.distance) * cameraLerpSpeed;
    cameraState.initialized = true;

    perspectiveCam.position.set(
      cameraState.target.x,
      cameraState.target.y + cameraState.distance * 0.08,
      cameraState.target.z + cameraState.distance,
    );

    const zoomProximity = Math.min(1, Math.max(0, 1 - cameraState.distance / baselineDistance));
    const verticalElevationShift =
      VERTICAL_VIEW_OFFSET * 2 * Math.tan(halfVertFov) * cameraState.distance * Math.min(1, zoomProximity * 2);

    perspectiveCam.position.y -= verticalElevationShift;
    perspectiveCam.lookAt(cameraState.target.x, cameraState.target.y - verticalElevationShift, cameraState.target.z);

    for (const padElem of floorPad.children) {
      const padUniforms = ((padElem as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
      padUniforms.uFade!.value = bootStage * currentVisibility;
      padUniforms.uTime!.value = currentTimeSec;
    }

    if (highlightedOrgansMesh) {
      const organUniforms = highlightedOrgansMesh.material.uniforms;
      organUniforms.uTime!.value = currentTimeSec;
      organUniforms.uIn!.value = cubicEase((currentTimeSec - highlightTimestamp) / ORGAN_FADE_IN_SEC) * currentVisibility;

      organFocusProgress += ((selectedOrganIndex >= 0 ? 1 : 0) - organFocusProgress) * STRUCTURE_PICK_RATE;
      organUniforms.uPicked!.value = selectedOrganIndex >= 0 ? selectedOrganIndex : previousOrganIndex;
      organUniforms.uPick!.value = organFocusProgress;
    }

    if (skinMesh && particleDust && avatarModel) {
      const skinUniforms = skinMesh.material.uniforms;
      skinUniforms.uTime!.value = currentTimeSec;
      skinUniforms.uReveal!.value = materializationStage;
      skinUniforms.uCentre!.value = perspectiveCam.position.length();
      skinUniforms.uFade!.value = FIGURE_OPACITY_GAIN * currentVisibility * (highlightedOrgansMesh ? 0.7 : 1.0);

      const scanProgress = (currentTimeSec - scanStartEpoch) / SCAN_DURATION_SEC;
      skinUniforms.uScanOn!.value = scanProgress >= 0 && scanProgress <= 1 ? 1 : 0;
      skinUniforms.uScanY!.value =
        avatarModel.top - (avatarModel.top - avatarModel.bottom) * cubicEase(scanProgress);

      const dustUniforms = particleDust.material.uniforms;
      dustUniforms.uTime!.value = currentTimeSec;
      dustUniforms.uAssemble!.value = deployStage;
      dustUniforms.uDust!.value = (1 - materializationStage * 0.85) * currentVisibility * (1 - zoomProximity);
      dustUniforms.uPixel!.value = screenPixelRatio * (container.clientHeight / 700);
      particleDust.geometry.setDrawRange(0, Math.round(targetDustCount * particleWeight));
    }
  };

  const unbindLayer = config.host.addLayer({
    scene: sceneGraph,
    camera: perspectiveCam,
    update: renderFrameUpdate,
    rect() {
      if (container.offsetParent === null || container.classList.contains("ml-hidden")) {
        return null;
      }
      const box = container.getBoundingClientRect();
      const originBox = config.frame.getBoundingClientRect();
      return {
        left: box.left - originBox.left,
        top: box.top - originBox.top,
        width: box.width,
        height: box.height,
      };
    },
  });

  return {
    setPresence(lvl: number) {
      targetPresence = Math.min(1, Math.max(0, lvl));
    },
    async show(requestedOrgans: readonly OrganRef[]): Promise<string[]> {
      const curReq = ++activeRequestId;
      if (requestedOrgans.length === 0) {
        clearLitGeometry();
        return [];
      }

      await initializationPromise;
      if (isDisposed || curReq !== activeRequestId || !avatarModel) {
        return [];
      }

      const mergedSubgeometries: THREE.BufferGeometry[] = [];
      const fileOrganMap = new Map<string, OrganRef[]>();
      for (const organ of requestedOrgans) {
        fileOrganMap.set(organ.file, [...(fileOrganMap.get(organ.file) ?? []), organ]);
      }

      const verifiedIds: string[] = [];

      for (const [filePath, refs] of fileOrganMap) {
        let nodeDict: Map<string, THREE.Object3D>;
        try {
          nodeDict = await getFileNodes(filePath);
        } catch {
          continue;
        }

        if (isDisposed || curReq !== activeRequestId) {
          return [];
        }

        for (const ref of refs) {
          const targetObj =
            nodeDict.get(ref.node) ??
            nodeDict.get(THREE.PropertyBinding.sanitizeNodeName(ref.node));
          if (!targetObj) continue;

          const assignedIndex = verifiedIds.push(ref.id) - 1;
          targetObj.traverse((sub) => {
            const m = sub as THREE.Mesh;
            if (m.isMesh && m.geometry) {
              mergedSubgeometries.push(worldGeometry(m, assignedIndex));
            }
          });
        }
      }

      clearLitGeometry();
      if (mergedSubgeometries.length === 0) {
        return [];
      }

      const unifiedGeo = mergeGeometries(mergedSubgeometries, false);
      for (const part of mergedSubgeometries) {
        part.dispose();
      }

      if (!unifiedGeo) {
        return [];
      }

      const { centre: normCenter, scale: normScale } = avatarModel.normalise;
      unifiedGeo.translate(-normCenter.x, -normCenter.y, -normCenter.z);
      unifiedGeo.scale(normScale, normScale, normScale);

      highlightedOrgansMesh = new THREE.Mesh(unifiedGeo, organMaterial());
      highlightedOrgansMesh.renderOrder = 2;
      pivotGroup.add(highlightedOrgansMesh);

      activeOrganIds = verifiedIds;

      const positionBuffer = unifiedGeo.getAttribute("position");
      const regionBuffer = unifiedGeo.getAttribute("region");
      organBoundingBoxes = verifiedIds.map(() => new THREE.Box3());

      const coordSample = new THREE.Vector3();
      for (let v = 0; v < positionBuffer.count; v++) {
        const rIndex = regionBuffer.getX(v);
        coordSample.fromBufferAttribute(positionBuffer, v);
        organBoundingBoxes[rIndex]?.expandByPoint(coordSample);
      }

      collectiveBounds = new THREE.Box3();
      for (const b of organBoundingBoxes) {
        if (!b.isEmpty()) collectiveBounds.union(b);
      }

      highlightTimestamp = performance.now() / 1000;
      scanStartEpoch = highlightTimestamp;
      return verifiedIds;
    },
    zoom(enableZoom: boolean, targetId: string | null = null) {
      if (!enableZoom || !highlightedOrgansMesh) {
        activeZoomTarget = -2;
        return;
      }
      const organIdx = targetId === null ? -1 : activeOrganIds.indexOf(targetId);
      activeZoomTarget = organIdx >= 0 && !organBoundingBoxes[organIdx]!.isEmpty() ? organIdx : -1;
    },
    pick(id: string | null) {
      const idx = id === null ? -1 : activeOrganIds.indexOf(id);
      if (idx >= 0) {
        previousOrganIndex = idx;
      }
      selectedOrganIndex = idx;
    },
    skipIntro() {
      const totalIntroSeconds = STAGES.boot + STAGES.deploy + STAGES.materialize;
      if (startEpochSec !== null && getRunningTime() < totalIntroSeconds) {
        timeSkipOffset += totalIntroSeconds - getRunningTime();
      }
    },
    dispose() {
      isDisposed = true;
      unbindLayer();

      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerUp);

      clearLitGeometry();
      releaseDraco(config.dracoPath);
      cachedFileHierarchy.clear();
      lightingProfile?.dispose();

      sceneGraph.traverse((node) => {
        const m = node as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) {
          mat.forEach((entry) => entry.dispose());
        } else {
          mat?.dispose();
        }
      });
    },
  };
}

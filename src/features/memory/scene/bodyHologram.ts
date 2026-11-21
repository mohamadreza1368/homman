/**
 * HOOMAAN Memory Laboratory - 3D Anatomical Avatar Hologram Layer
 *
 * Clean-room implementation providing holographic human projection,
 * particle point clouds, selective organ illumination, and focus zooming.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  acquireDraco,
  loadBrain,
  releaseDraco,
  type Brain,
  type BrainStructure,
} from "./brainLoader";
import { projector } from "./environment";
import { brainMaterial, brainPoints, RegionLight } from "./hologram";
import { organMaterial } from "./bodyHologramMaterial";
import type { SceneLayer } from "./memoryScene";
import {
  computeHologramCameraTarget,
  type CameraRigMetrics,
} from "./hologramCameraRig";
import {
  fetchOrganBatch,
  type OrganRef,
} from "./hologramOrganLoader";

export type { OrganRef };

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

export interface BodyHologram {
  setPresence(level: number): void;
  show(organs: readonly OrganRef[]): Promise<string[]>;
  pick(id: string | null): void;
  zoom(on: boolean, id?: string | null): void;
  skipIntro(): void;
  dispose(): void;
}

const TIMELINE = {
  bootDuration: 1.1,
  deployDuration: 2.4,
  materializeDuration: 1.4,
} as const;

const TOTAL_INTRO_SPAN =
  TIMELINE.bootDuration + TIMELINE.deployDuration + TIMELINE.materializeDuration;

function smoothInterpolate(val: number): number {
  const norm = Math.min(1, Math.max(0, val));
  return norm * norm * (3 - 2 * norm);
}

export function createBodyHologram(
  container: HTMLElement,
  config: BodyHologramOptions,
): BodyHologram {
  const reducedMotion =
    config.reducedMotion ??
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

  const pedestal = projector();
  pedestal.scale.setScalar(0.4);

  const stageRoot = new THREE.Group();
  scene.add(pedestal, stageRoot);

  let avatarData: Brain | null = null;
  let figureMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let figureDust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let illumination: RegionLight | null = null;

  let highlightMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let highlightStartTime = 0;
  let loadedOrganIds: string[] = [];
  let organBoundingBoxes: THREE.Box3[] = [];
  let unionBoundingBox: THREE.Box3 | null = null;

  let activeZoomTarget = -2; // -2: overview, -1: all organs, >=0: individual
  let selectedOrganIdx = -1;
  let lastOrganIdx = -1;
  let organSelectTransition = 0;

  let startClock: number | null = null;
  let skipTimeOffset = 0;
  let presenceTarget = 1;
  let visiblePresence = 1;
  let scanStartTime = -100;
  let orbitAzimuth = 0;
  let destroyed = false;
  let loadRequestId = 0;

  const particleCapacity = reducedMotion ? 4000 : 9000;
  const cameraTracker = { target: new THREE.Vector3(), distance: 1, ready: false };

  const gltfLoader = new GLTFLoader().setDRACOLoader(acquireDraco(config.dracoPath));
  const gltfNodeCache = new Map<string, Promise<Map<string, THREE.Object3D>>>();

  const modelMetrics: CameraRigMetrics = { height: 2, bottom: -1 };

  const readyPromise = (async () => {
    try {
      const brain = await loadBrain({
        meshUrl: config.meshUrl,
        structures: config.structures,
        dracoPath: config.dracoPath,
      });

      if (destroyed) {
        brain.geometry.dispose();
        return;
      }

      avatarData = brain;
      modelMetrics.height = brain.top - brain.bottom;
      modelMetrics.bottom = brain.bottom;

      illumination = new RegionLight(brain.regions.length);
      figureMesh = new THREE.Mesh(brain.geometry, brainMaterial(illumination));

      figureDust = brainPoints(brain.geometry, particleCapacity, 11);
      figureDust.material.uniforms.uRegions!.value = illumination.texture;
      figureDust.material.uniforms.uRegionCount!.value = illumination.size;

      stageRoot.add(figureMesh, figureDust);
      stageRoot.position.y = -1.55 * 0.4 - brain.bottom + 0.02;
      pedestal.position.y = -1.55 * 0.4;

      startClock = performance.now() / 1000;
    } catch (err) {
      config.onError?.(err);
    }
  })();

  function removeHighlightMesh(): void {
    if (!highlightMesh) return;
    stageRoot.remove(highlightMesh);
    highlightMesh.geometry.dispose();
    highlightMesh.material.dispose();
    highlightMesh = null;
    loadedOrganIds = [];
    selectedOrganIdx = -1;
    lastOrganIdx = -1;
    organSelectTransition = 0;
    organBoundingBoxes = [];
    unionBoundingBox = null;
    activeZoomTarget = -2;
  }

  // Pointer drag handling
  let dragAnchor: { x: number; spin: number } | null = null;
  container.style.cursor = "grab";

  function onPointerDown(e: PointerEvent): void {
    if ((e.target as Element | null)?.closest?.("button")) return;
    e.preventDefault();
    dragAnchor = { x: e.clientX, spin: orbitAzimuth };
    container.setPointerCapture(e.pointerId);
    container.style.cursor = "grabbing";
  }

  function onPointerMove(e: PointerEvent): void {
    if (dragAnchor) {
      orbitAzimuth = dragAnchor.spin + (e.clientX - dragAnchor.x) * 0.008;
    }
  }

  function onPointerUp(): void {
    dragAnchor = null;
    container.style.cursor = "grab";
  }

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);

  function getPlaybackClock(): number {
    return startClock === null
      ? 0
      : performance.now() / 1000 - startClock + skipTimeOffset;
  }

  function onUpdate(
    currentTimeSec: number,
    aspect: number,
    _pixelRatio: number,
    _particlesRatio: number,
  ): void {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const t = getPlaybackClock();
    const bootPhase = smoothInterpolate(t / TIMELINE.bootDuration);
    const deployPhase = smoothInterpolate((t - TIMELINE.bootDuration) / TIMELINE.deployDuration);
    const materializePhase = smoothInterpolate(
      (t - TIMELINE.bootDuration - TIMELINE.deployDuration) / TIMELINE.materializeDuration,
    );

    visiblePresence += (presenceTarget - visiblePresence) * 0.08;

    const speed = reducedMotion ? 0.35 : 1.0;
    if (!dragAnchor && activeZoomTarget === -2) {
      orbitAzimuth += 0.0025 * speed;
    }
    stageRoot.rotation.y = orbitAzimuth;

    const cameraTarget = computeHologramCameraTarget(
      camera,
      modelMetrics,
      stageRoot.position.y,
      activeZoomTarget,
      organBoundingBoxes,
      unionBoundingBox,
      orbitAzimuth,
    );

    if (!cameraTracker.ready) {
      cameraTracker.target.copy(cameraTarget.target);
      cameraTracker.distance = cameraTarget.distance;
      cameraTracker.ready = true;
    } else {
      const smoothing = reducedMotion ? 0.12 : 0.06;
      cameraTracker.target.lerp(cameraTarget.target, smoothing);
      cameraTracker.distance += (cameraTarget.distance - cameraTracker.distance) * smoothing;
    }

    camera.position.set(
      cameraTracker.target.x,
      cameraTracker.target.y,
      cameraTracker.target.z + cameraTracker.distance,
    );
    camera.lookAt(cameraTracker.target);

    // Uniform updates on pedestal emitter disc and cone
    pedestal.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material && "uniforms" in mesh.material) {
        const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
        if (uniforms.uFade) uniforms.uFade.value = bootPhase * visiblePresence;
        if (uniforms.uTime) uniforms.uTime.value = currentTimeSec;
      }
    });

    if (figureMesh && figureDust && illumination) {
      const matMesh = figureMesh.material;
      const matDust = figureDust.material;

      matMesh.uniforms.uTime!.value = currentTimeSec;
      matMesh.uniforms.uMaterialize!.value = materializePhase;
      matMesh.uniforms.uPresence!.value = visiblePresence;
      matMesh.uniforms.uBoot!.value = bootPhase;
      matMesh.uniforms.uDeploy!.value = deployPhase;
      matMesh.uniforms.uRegions!.value = illumination.texture;

      matDust.uniforms.uTime!.value = currentTimeSec;
      matDust.uniforms.uDeploy!.value = deployPhase;
      matDust.uniforms.uMaterialize!.value = materializePhase;
      matDust.uniforms.uPresence!.value = visiblePresence;
      matDust.uniforms.uBoot!.value = bootPhase;

      const scanSec = currentTimeSec - scanStartTime;
      const scanPhase = reducedMotion ? 1 : Math.min(1, Math.max(0, scanSec / 2.2));
      matMesh.uniforms.uScanProgress!.value = scanPhase;
      matDust.uniforms.uScanProgress!.value = scanPhase;
    }

    if (highlightMesh) {
      const organMat = highlightMesh.material;
      organMat.uniforms.uTime!.value = currentTimeSec;
      organMat.uniforms.uPresence!.value = visiblePresence;

      const elapsed = currentTimeSec - highlightStartTime;
      organMat.uniforms.uFadeIn!.value = reducedMotion ? 1 : Math.min(1, elapsed / 0.6);

      if (organSelectTransition < 1) {
        organSelectTransition = Math.min(1, organSelectTransition + 0.05);
      }
      organMat.uniforms.uActiveIndex!.value = selectedOrganIdx;
      organMat.uniforms.uLastActiveIndex!.value = lastOrganIdx;
      organMat.uniforms.uSelectTransition!.value = organSelectTransition;
    }
  }

  const unregisterLayer = config.host.addLayer({
    scene,
    camera,
    rect() {
      const b = container.getBoundingClientRect();
      const origin = config.frame.getBoundingClientRect();
      return {
        left: b.left - origin.left,
        top: b.top - origin.top,
        width: b.width,
        height: b.height,
      };
    },
    update(sec, asp, pr, partR) {
      onUpdate(sec, asp, pr, partR);
    },
  });

  return {
    setPresence(level: number) {
      presenceTarget = Math.min(1, Math.max(0, level));
    },

    async show(requestedOrgans: readonly OrganRef[]): Promise<string[]> {
      const currentReq = ++loadRequestId;
      if (requestedOrgans.length === 0) {
        removeHighlightMesh();
        return [];
      }

      await readyPromise;
      if (destroyed || currentReq !== loadRequestId || !avatarData) {
        return [];
      }

      const batch = await fetchOrganBatch(
        requestedOrgans,
        avatarData,
        config.fileUrl,
        gltfLoader,
        gltfNodeCache,
        () => destroyed || currentReq !== loadRequestId,
      );

      if (!batch) {
        removeHighlightMesh();
        return [];
      }

      removeHighlightMesh();

      highlightMesh = new THREE.Mesh(batch.unifiedGeometry, organMaterial());
      highlightMesh.renderOrder = 2;
      stageRoot.add(highlightMesh);

      loadedOrganIds = batch.loadedOrganIds;
      organBoundingBoxes = batch.organBoundingBoxes;
      unionBoundingBox = batch.unionBoundingBox;

      highlightStartTime = performance.now() / 1000;
      scanStartTime = highlightStartTime;

      return loadedOrganIds;
    },

    pick(id: string | null) {
      const targetIdx = id === null ? -1 : loadedOrganIds.indexOf(id);
      if (targetIdx === selectedOrganIdx) return;
      lastOrganIdx = selectedOrganIdx;
      selectedOrganIdx = targetIdx;
      organSelectTransition = 0;
    },

    zoom(on: boolean, id?: string | null) {
      if (!on) {
        activeZoomTarget = -2;
        return;
      }
      if (id) {
        const foundIdx = loadedOrganIds.indexOf(id);
        if (foundIdx >= 0) {
          activeZoomTarget = foundIdx;
          return;
        }
      }
      activeZoomTarget = -1;
    },

    skipIntro() {
      if (startClock !== null) {
        skipTimeOffset = TOTAL_INTRO_SPAN + 1;
      }
    },

    dispose() {
      destroyed = true;
      unregisterLayer();

      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);

      removeHighlightMesh();
      if (avatarData) {
        avatarData.geometry.dispose();
      }
      releaseDraco(config.dracoPath);
    },
  };
}

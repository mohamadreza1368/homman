/**
 * HOOMAAN Memory Laboratory - 3D Anatomical Avatar Hologram Layer
 *
 * Clean-room implementation providing holographic human projection,
 * particle point clouds, selective organ illumination, and focus zooming.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  acquireDraco,
  loadBrain,
  releaseDraco,
  worldGeometry,
  type Brain,
  type BrainStructure,
} from "./brainLoader";
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
  const targetFocusPoint = new THREE.Vector3();
  const boxExtent = new THREE.Vector3();
  const VERT_AXIS = new THREE.Vector3(0, 1, 0);

  const gltfLoader = new GLTFLoader().setDRACOLoader(acquireDraco(config.dracoPath));
  const gltfNodeCache = new Map<string, Promise<Map<string, THREE.Object3D>>>();

  function loadFileHierarchy(filename: string): Promise<Map<string, THREE.Object3D>> {
    let pending = gltfNodeCache.get(filename);
    if (!pending) {
      pending = gltfLoader.loadAsync(config.fileUrl(filename)).then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const map = new Map<string, THREE.Object3D>();
        gltf.scene.traverse((node) => map.set(node.name, node));
        return map;
      });
      pending.catch(() => gltfNodeCache.delete(filename));
      gltfNodeCache.set(filename, pending);
    }
    return pending;
  }

  const modelMetrics = { height: 2, bottom: -1 };

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
    pixelRatio: number,
    particlesRatio: number,
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

    const halfFovRad = THREE.MathUtils.degToRad(camera.fov) * 0.5;
    const vSpan = (modelMetrics.height + 0.55) * 0.5;
    const hSpan = (1.8 * 0.4) / Math.max(0.2, camera.aspect);
    const baseDistance = Math.max(vSpan, hSpan) / Math.tan(halfFovRad);

    let optimalDistance = baseDistance;
    targetFocusPoint.set(
      0,
      stageRoot.position.y + modelMetrics.bottom + modelMetrics.height * 0.5 - 0.12,
      0,
    );

    const targetBox =
      activeZoomTarget >= 0
        ? organBoundingBoxes[activeZoomTarget]
        : activeZoomTarget === -1
          ? unionBoundingBox
          : null;

    if (targetBox) {
      const radius = Math.max(0.035, targetBox.getSize(boxExtent).length() * 0.5);
      targetBox
        .getCenter(targetFocusPoint)
        .applyAxisAngle(VERT_AXIS, orbitAzimuth)
        .add(stageRoot.position);
      const aspectTan = Math.tan(halfFovRad) * Math.min(1, camera.aspect);
      optimalDistance = Math.min(optimalDistance, (radius * 2.4) / aspectTan);
    }

    const lerpRate = cameraTracker.ready && !reducedMotion ? 0.07 : 1.0;
    cameraTracker.target.lerp(targetFocusPoint, lerpRate);
    cameraTracker.distance += (optimalDistance - cameraTracker.distance) * lerpRate;
    cameraTracker.ready = true;

    camera.position.set(
      cameraTracker.target.x,
      cameraTracker.target.y + cameraTracker.distance * 0.08,
      cameraTracker.target.z + cameraTracker.distance,
    );

    const zoomFraction = Math.min(1, Math.max(0, 1 - cameraTracker.distance / baseDistance));
    const verticalShift =
      0.16 * 2 * Math.tan(halfFovRad) * cameraTracker.distance * Math.min(1, zoomFraction * 2);

    camera.position.y -= verticalShift;
    camera.lookAt(
      cameraTracker.target.x,
      cameraTracker.target.y - verticalShift,
      cameraTracker.target.z,
    );

    for (const child of pedestal.children) {
      const u = ((child as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
      u.uFade!.value = bootPhase * visiblePresence;
      u.uTime!.value = currentTimeSec;
    }

    if (highlightMesh) {
      const u = highlightMesh.material.uniforms;
      u.uTime!.value = currentTimeSec;
      u.uIn!.value =
        smoothInterpolate((currentTimeSec - highlightStartTime) / 0.9) * visiblePresence;

      organSelectTransition +=
        ((selectedOrganIdx >= 0 ? 1 : 0) - organSelectTransition) * 0.15;
      u.uPicked!.value = selectedOrganIdx >= 0 ? selectedOrganIdx : lastOrganIdx;
      u.uPick!.value = organSelectTransition;
    }

    if (figureMesh && figureDust && avatarData) {
      const sUniforms = figureMesh.material.uniforms;
      sUniforms.uTime!.value = currentTimeSec;
      sUniforms.uReveal!.value = materializePhase;
      sUniforms.uCentre!.value = camera.position.length();
      sUniforms.uFade!.value = 2.6 * visiblePresence * (highlightMesh ? 0.7 : 1.0);

      const scanTime = (currentTimeSec - scanStartTime) / 1.8;
      sUniforms.uScanOn!.value = scanTime >= 0 && scanTime <= 1 ? 1 : 0;
      sUniforms.uScanY!.value =
        avatarData.top - (avatarData.top - avatarData.bottom) * smoothInterpolate(scanTime);

      const dUniforms = figureDust.material.uniforms;
      dUniforms.uTime!.value = currentTimeSec;
      dUniforms.uAssemble!.value = deployPhase;
      dUniforms.uDust!.value =
        (1 - materializePhase * 0.85) * visiblePresence * (1 - zoomFraction);
      dUniforms.uPixel!.value = pixelRatio * (container.clientHeight / 700);
      figureDust.geometry.setDrawRange(0, Math.round(particleCapacity * particlesRatio));
    }
  }

  const unbindHostLayer = config.host.addLayer({
    scene,
    camera,
    update: onUpdate,
    rect() {
      if (container.offsetParent === null || container.classList.contains("ml-hidden")) {
        return null;
      }
      const b = container.getBoundingClientRect();
      const origin = config.frame.getBoundingClientRect();
      return {
        left: b.left - origin.left,
        top: b.top - origin.top,
        width: b.width,
        height: b.height,
      };
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

      const files = new Map<string, OrganRef[]>();
      for (const organ of requestedOrgans) {
        const list = files.get(organ.file) ?? [];
        list.push(organ);
        files.set(organ.file, list);
      }

      const verified: string[] = [];
      const parts: THREE.BufferGeometry[] = [];

      for (const [filePath, refs] of files) {
        let nodeDict: Map<string, THREE.Object3D>;
        try {
          nodeDict = await loadFileHierarchy(filePath);
        } catch {
          continue;
        }

        if (destroyed || currentReq !== loadRequestId) return [];

        for (const ref of refs) {
          const target =
            nodeDict.get(ref.node) ??
            nodeDict.get(THREE.PropertyBinding.sanitizeNodeName(ref.node));
          if (!target) continue;

          const regionIndex = verified.push(ref.id) - 1;
          target.traverse((child) => {
            const m = child as THREE.Mesh;
            if (m.isMesh && m.geometry) {
              parts.push(worldGeometry(m, regionIndex));
            }
          });
        }
      }

      removeHighlightMesh();
      if (parts.length === 0) return [];

      const unified = mergeGeometries(parts, false);
      for (const part of parts) {
        part.dispose();
      }
      if (!unified) return [];

      const { centre: c, scale: s } = avatarData.normalise;
      unified.translate(-c.x, -c.y, -c.z);
      unified.scale(s, s, s);

      highlightMesh = new THREE.Mesh(unified, organMaterial());
      highlightMesh.renderOrder = 2;
      stageRoot.add(highlightMesh);

      loadedOrganIds = verified;

      const posAttr = unified.getAttribute("position");
      const regAttr = unified.getAttribute("region");
      organBoundingBoxes = verified.map(() => new THREE.Box3());

      const tempPoint = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        const regIdx = regAttr.getX(i);
        tempPoint.fromBufferAttribute(posAttr, i);
        organBoundingBoxes[regIdx]?.expandByPoint(tempPoint);
      }

      unionBoundingBox = new THREE.Box3();
      for (const box of organBoundingBoxes) {
        if (!box.isEmpty()) unionBoundingBox.union(box);
      }

      highlightStartTime = performance.now() / 1000;
      scanStartTime = highlightStartTime;
      return verified;
    },

    zoom(enable: boolean, targetId: string | null = null) {
      if (!enable || !highlightMesh) {
        activeZoomTarget = -2;
        return;
      }
      const idx = targetId === null ? -1 : loadedOrganIds.indexOf(targetId);
      activeZoomTarget =
        idx >= 0 && !organBoundingBoxes[idx]!.isEmpty() ? idx : -1;
    },

    pick(id: string | null) {
      const idx = id === null ? -1 : loadedOrganIds.indexOf(id);
      if (idx >= 0) {
        lastOrganIdx = idx;
      }
      selectedOrganIdx = idx;
    },

    skipIntro() {
      if (startClock !== null && getPlaybackClock() < TOTAL_INTRO_SPAN) {
        skipTimeOffset += TOTAL_INTRO_SPAN - getPlaybackClock();
      }
    },

    dispose() {
      destroyed = true;
      unbindHostLayer();

      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);

      removeHighlightMesh();
      releaseDraco(config.dracoPath);
      gltfNodeCache.clear();
      illumination?.dispose();

      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) {
          mat.forEach((x) => x.dispose());
        } else {
          mat?.dispose();
        }
      });
    },
  };
}

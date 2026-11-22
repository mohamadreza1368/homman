/**
 * HOOMAAN Memory Laboratory - 3D Anatomical Avatar Hologram Rig
 *
 * Clean-room OOP implementation providing holographic human projection,
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
import { attachDragOrbit, type DragOrbitController } from "./hologramDragOrbit";
import { evaluateIntroPhases, TOTAL_INTRO_SPAN } from "./hologramIntroPhases";

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

/**
 * Encapsulates the 3D anatomical avatar hologram stage, particle field,
 * dynamic organ meshes, camera framing, and interaction tracking.
 */
export class BodyHologramRig implements BodyHologram {
  private readonly container: HTMLElement;
  private readonly config: BodyHologramOptions;
  private readonly isReducedMotion: boolean;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly pedestal: THREE.Object3D;
  private readonly stageRoot: THREE.Group;

  private avatarData: Brain | null = null;
  private figureMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private figureDust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private illumination: RegionLight | null = null;

  private highlightMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private highlightStartTime = 0;
  private loadedOrganIds: string[] = [];
  private organBoundingBoxes: THREE.Box3[] = [];
  private unionBoundingBox: THREE.Box3 | null = null;

  private activeZoomTarget = -2; // -2: overview, -1: all organs, >=0: individual index
  private selectedOrganIdx = -1;
  private lastOrganIdx = -1;
  private organSelectTransition = 0;

  private startClock: number | null = null;
  private skipTimeOffset = 0;
  private presenceTarget = 1;
  private visiblePresence = 1;
  private scanStartTime = -100;
  private isDestroyed = false;
  private loadRequestId = 0;

  private readonly modelMetrics: CameraRigMetrics = { height: 2, bottom: -1 };
  private readonly cameraTracker = { target: new THREE.Vector3(), distance: 1, ready: false };
  private readonly particleCapacity: number;

  private readonly gltfLoader: GLTFLoader;
  private readonly gltfNodeCache = new Map<string, Promise<Map<string, THREE.Object3D>>>();
  private readonly dragOrbit: DragOrbitController;
  private readonly unregisterLayer: () => void;
  private readonly readyPromise: Promise<void>;

  constructor(container: HTMLElement, config: BodyHologramOptions) {
    this.container = container;
    this.config = config;

    this.isReducedMotion =
      config.reducedMotion ??
      (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

    this.particleCapacity = this.isReducedMotion ? 4000 : 9000;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

    this.pedestal = projector();
    this.pedestal.scale.setScalar(0.4);

    this.stageRoot = new THREE.Group();
    this.scene.add(this.pedestal, this.stageRoot);

    this.gltfLoader = new GLTFLoader().setDRACOLoader(acquireDraco(config.dracoPath));
    this.dragOrbit = attachDragOrbit(container);

    this.readyPromise = this.initAvatar();

    this.unregisterLayer = config.host.addLayer({
      scene: this.scene,
      camera: this.camera,
      rect: () => {
        const b = this.container.getBoundingClientRect();
        const origin = this.config.frame.getBoundingClientRect();
        return {
          left: b.left - origin.left,
          top: b.top - origin.top,
          width: b.width,
          height: b.height,
        };
      },
      update: (sec, asp, pr, partR) => {
        this.onRenderUpdate(sec, asp, pr, partR);
      },
    });
  }

  private async initAvatar(): Promise<void> {
    try {
      const brain = await loadBrain({
        meshUrl: this.config.meshUrl,
        structures: this.config.structures,
        dracoPath: this.config.dracoPath,
      });

      if (this.isDestroyed) {
        brain.geometry.dispose();
        return;
      }

      this.avatarData = brain;
      this.modelMetrics.height = brain.top - brain.bottom;
      this.modelMetrics.bottom = brain.bottom;

      this.illumination = new RegionLight(brain.regions.length);
      this.figureMesh = new THREE.Mesh(brain.geometry, brainMaterial(this.illumination));

      this.figureDust = brainPoints(brain.geometry, this.particleCapacity, 11);
      this.figureDust.material.uniforms.uRegions!.value = this.illumination.texture;
      this.figureDust.material.uniforms.uRegionCount!.value = this.illumination.size;

      this.stageRoot.add(this.figureMesh, this.figureDust);
      this.stageRoot.position.y = -1.55 * 0.4 - brain.bottom + 0.02;
      this.pedestal.position.y = -1.55 * 0.4;

      this.startClock = performance.now() / 1000;
    } catch (err) {
      this.config.onError?.(err);
    }
  }

  private removeHighlightMesh(): void {
    if (!this.highlightMesh) return;
    this.stageRoot.remove(this.highlightMesh);
    this.highlightMesh.geometry.dispose();
    this.highlightMesh.material.dispose();
    this.highlightMesh = null;
    this.loadedOrganIds = [];
    this.selectedOrganIdx = -1;
    this.lastOrganIdx = -1;
    this.organSelectTransition = 0;
    this.organBoundingBoxes = [];
    this.unionBoundingBox = null;
    this.activeZoomTarget = -2;
  }

  private getPlaybackClock(): number {
    return this.startClock === null
      ? 0
      : performance.now() / 1000 - this.startClock + this.skipTimeOffset;
  }

  private onRenderUpdate(
    currentTimeSec: number,
    aspect: number,
    _pixelRatio: number,
    _particlesRatio: number,
  ): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const t = this.getPlaybackClock();
    const { bootPhase, deployPhase, materializePhase } = evaluateIntroPhases(t);

    this.visiblePresence += (this.presenceTarget - this.visiblePresence) * 0.08;

    const speed = this.isReducedMotion ? 0.35 : 1.0;
    let currentAzimuth = this.dragOrbit.getAzimuth();
    if (!this.dragOrbit.isDragging() && this.activeZoomTarget === -2) {
      currentAzimuth += 0.0025 * speed;
      this.dragOrbit.setAzimuth(currentAzimuth);
    }
    this.stageRoot.rotation.y = currentAzimuth;

    const cameraTarget = computeHologramCameraTarget(
      this.camera,
      this.modelMetrics,
      this.stageRoot.position.y,
      this.activeZoomTarget,
      this.organBoundingBoxes,
      this.unionBoundingBox,
      currentAzimuth,
    );

    if (!this.cameraTracker.ready) {
      this.cameraTracker.target.copy(cameraTarget.target);
      this.cameraTracker.distance = cameraTarget.distance;
      this.cameraTracker.ready = true;
    } else {
      const smoothing = this.isReducedMotion ? 0.12 : 0.06;
      this.cameraTracker.target.lerp(cameraTarget.target, smoothing);
      this.cameraTracker.distance +=
        (cameraTarget.distance - this.cameraTracker.distance) * smoothing;
    }

    this.camera.position.set(
      this.cameraTracker.target.x,
      this.cameraTracker.target.y,
      this.cameraTracker.target.z + this.cameraTracker.distance,
    );
    this.camera.lookAt(this.cameraTracker.target);

    // Pedestal uniform updates
    this.pedestal.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material && "uniforms" in mesh.material) {
        const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
        if (uniforms.uFade) uniforms.uFade.value = bootPhase * this.visiblePresence;
        if (uniforms.uTime) uniforms.uTime.value = currentTimeSec;
      }
    });

    if (this.figureMesh && this.figureDust && this.illumination) {
      const matMesh = this.figureMesh.material;
      const matDust = this.figureDust.material;

      matMesh.uniforms.uTime!.value = currentTimeSec;
      matMesh.uniforms.uMaterialize!.value = materializePhase;
      matMesh.uniforms.uPresence!.value = this.visiblePresence;
      matMesh.uniforms.uBoot!.value = bootPhase;
      matMesh.uniforms.uDeploy!.value = deployPhase;
      matMesh.uniforms.uRegions!.value = this.illumination.texture;

      matDust.uniforms.uTime!.value = currentTimeSec;
      matDust.uniforms.uDeploy!.value = deployPhase;
      matDust.uniforms.uMaterialize!.value = materializePhase;
      matDust.uniforms.uPresence!.value = this.visiblePresence;
      matDust.uniforms.uBoot!.value = bootPhase;

      const scanSec = currentTimeSec - this.scanStartTime;
      const scanPhase = this.isReducedMotion ? 1 : Math.min(1, Math.max(0, scanSec / 2.2));
      matMesh.uniforms.uScanProgress!.value = scanPhase;
      matDust.uniforms.uScanProgress!.value = scanPhase;
    }

    if (this.highlightMesh) {
      const organMat = this.highlightMesh.material;
      organMat.uniforms.uTime!.value = currentTimeSec;
      organMat.uniforms.uPresence!.value = this.visiblePresence;

      const elapsed = currentTimeSec - this.highlightStartTime;
      organMat.uniforms.uFadeIn!.value = this.isReducedMotion ? 1 : Math.min(1, elapsed / 0.6);

      if (this.organSelectTransition < 1) {
        this.organSelectTransition = Math.min(1, this.organSelectTransition + 0.05);
      }
      organMat.uniforms.uActiveIndex!.value = this.selectedOrganIdx;
      organMat.uniforms.uLastActiveIndex!.value = this.lastOrganIdx;
      organMat.uniforms.uSelectTransition!.value = this.organSelectTransition;
    }
  }

  public setPresence(level: number): void {
    this.presenceTarget = Math.min(1, Math.max(0, level));
  }

  public async show(requestedOrgans: readonly OrganRef[]): Promise<string[]> {
    const currentReq = ++this.loadRequestId;
    if (requestedOrgans.length === 0) {
      this.removeHighlightMesh();
      return [];
    }

    await this.readyPromise;
    if (this.isDestroyed || currentReq !== this.loadRequestId || !this.avatarData) {
      return [];
    }

    const batch = await fetchOrganBatch(
      requestedOrgans,
      this.avatarData,
      this.config.fileUrl,
      this.gltfLoader,
      this.gltfNodeCache,
      () => this.isDestroyed || currentReq !== this.loadRequestId,
    );

    if (!batch) {
      this.removeHighlightMesh();
      return [];
    }

    this.removeHighlightMesh();

    this.highlightMesh = new THREE.Mesh(batch.unifiedGeometry, organMaterial());
    this.highlightMesh.renderOrder = 2;
    this.stageRoot.add(this.highlightMesh);

    this.loadedOrganIds = batch.loadedOrganIds;
    this.organBoundingBoxes = batch.organBoundingBoxes;
    this.unionBoundingBox = batch.unionBoundingBox;

    this.highlightStartTime = performance.now() / 1000;
    this.scanStartTime = this.highlightStartTime;

    return this.loadedOrganIds;
  }

  public pick(id: string | null): void {
    const targetIdx = id === null ? -1 : this.loadedOrganIds.indexOf(id);
    if (targetIdx === this.selectedOrganIdx) return;
    this.lastOrganIdx = this.selectedOrganIdx;
    this.selectedOrganIdx = targetIdx;
    this.organSelectTransition = 0;
  }

  public zoom(on: boolean, id?: string | null): void {
    if (!on) {
      this.activeZoomTarget = -2;
      return;
    }
    if (id) {
      const foundIdx = this.loadedOrganIds.indexOf(id);
      if (foundIdx >= 0) {
        this.activeZoomTarget = foundIdx;
        return;
      }
    }
    this.activeZoomTarget = -1;
  }

  public skipIntro(): void {
    if (this.startClock !== null) {
      this.skipTimeOffset = TOTAL_INTRO_SPAN + 1;
    }
  }

  public dispose(): void {
    this.isDestroyed = true;
    this.unregisterLayer();
    this.dragOrbit.dispose();

    this.removeHighlightMesh();
    if (this.avatarData) {
      this.avatarData.geometry.dispose();
    }
    releaseDraco(this.config.dracoPath);
  }
}

export function createBodyHologram(
  container: HTMLElement,
  config: BodyHologramOptions,
): BodyHologram {
  return new BodyHologramRig(container, config);
}

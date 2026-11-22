/**
 * HOOMAAN Memory Laboratory - Interactive 3D Neural Viewport Engine
 *
 * Clean-room OOP implementation managing the memory constellation,
 * synaptic pathways, adaptive quality governor, and interactive raycasting.
 */

import * as THREE from "three";

import { loadBrain } from "./brainLoader";
import { floorGrid, orbitRings, projector } from "./environment";
import { brainMaterial, brainPoints, RegionLight } from "./hologram";
import { nameplate } from "./nameplate";
import { createPost, type Post } from "./post";
import { classifyAdapter, FrameGovernor, LEVELS, pixelRatioFor, startingLevel } from "./quality";
import {
  easeCubic,
  ERASE_TRANSITION_SEC,
  MAX_MAPPING_SEC,
  MIN_MAPPING_SEC,
  PICK_HIT_PROXIMITY_PX,
  STAGES,
  type FocusMargins,
  type LabPhase,
  type MemoryScene,
  type MemorySceneOptions,
  type SceneLayer,
} from "./memorySceneTypes";
import {
  cortexPlaces,
  memoryNodes,
  memoryThread,
  updateThreadPresence,
} from "./memoryVisuals";
import { LayerPass } from "./LayerPass";

export * from "./memorySceneTypes";

function detectGpuString(glRenderer: THREE.WebGLRenderer): string | null {
  try {
    const gl = glRenderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    return String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {
    return null;
  }
}

/**
 * 3D Neural constellations viewport engine.
 * Encapsulates the WebGL rendering pipeline, adaptive quality governor,
 * multi-layer compositing, and user interaction mechanics.
 */
export class MemoryViewportEngine implements MemoryScene {
  private readonly container: HTMLElement;
  private readonly options: MemorySceneOptions;
  private readonly isReducedMotion: boolean;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly post: Post;

  private readonly adapter: ReturnType<typeof classifyAdapter>;
  private readonly initialTier: number;
  private readonly governor: FrameGovernor;

  private activeTier = -1;
  private isContextLost = false;

  private readonly registeredPassLayers = new Set<SceneLayer>();
  private readonly layerPass: LayerPass;

  // Scene visual components
  private readonly grid: THREE.Object3D;
  private readonly baseProjector: THREE.Object3D;
  private readonly rings: THREE.Object3D;
  private readonly brainPivot = new THREE.Group();
  private readonly signMesh: THREE.Object3D;

  private brainSurfaceMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private cloudPoints: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private memoryNodePoints: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private synapseLines: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;

  private nodeCoordinates: THREE.Vector3[] = [];
  private readonly presenceBuffer: Float32Array;
  private readonly activeEraseTransitions = new Map<number, { from: number; to: number; started: number }>();
  private readonly regionIllumination = new RegionLight(1);

  private readonly memoryCount: number;
  private readonly memoryKeyIndex: Map<string, number>;
  private readonly mappingPeriod: number;
  private readonly introSpan: number;
  private readonly totalIntroSequence: number;
  private readonly maxDustParticles: number;

  private sessionStartSec: number | null = null;
  private fastForwardSec = 0;
  private hoveredMemoryIdx = -1;
  private selectedMemoryIdx = -1;
  private turntableAngle = 0;

  private margins: FocusMargins = { left: 0, right: 0, top: 0, bottom: 0 };
  private readonly smoothCameraTarget = { x: 0, y: 0, zoom: 1 };

  private lastEmittedPhase: LabPhase | null = null;
  private lastEmittedCount = -1;
  private isDisposed = false;
  private rafHandle = 0;
  private lastRenderTime = 0;

  private pointerDrag: { x: number; angle: number } | null = null;
  private readonly resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, options: MemorySceneOptions) {
    this.container = container;
    this.options = options;

    this.isReducedMotion =
      options.reducedMotion ??
      (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

    this.memoryCount = options.memories.length;
    this.memoryKeyIndex = new Map(options.memories.map((m, i) => [m.key, i]));
    this.mappingPeriod = Math.min(MAX_MAPPING_SEC, Math.max(MIN_MAPPING_SEC, this.memoryCount * 0.22));
    this.introSpan = STAGES.boot + STAGES.deploy + STAGES.materialize;
    this.totalIntroSequence = this.introSpan + this.mappingPeriod;
    this.maxDustParticles = this.isReducedMotion ? 10000 : 20000;
    this.presenceBuffer = new Float32Array(Math.max(1, this.memoryCount)).fill(1);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x010408, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "ml-gl";
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
    this.post = createPost(this.renderer, this.scene, this.camera);

    this.adapter = classifyAdapter(detectGpuString(this.renderer));
    this.initialTier = startingLevel(this.adapter);
    this.governor = new FrameGovernor(this.initialTier);

    this.renderer.domElement.addEventListener("webglcontextlost", this.onGlLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.onGlRestored);

    this.layerPass = new LayerPass(
      this.registeredPassLayers,
      this.container,
      () => performance.now() / 1000,
      () => LEVELS[Math.max(0, this.activeTier)]!.particles,
    );
    this.post.composer.insertPass(this.layerPass, 1);

    this.grid = floorGrid();
    this.baseProjector = projector();
    this.rings = orbitRings();
    this.signMesh = nameplate();
    this.scene.add(this.grid, this.baseProjector, this.rings, this.brainPivot, this.signMesh);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
    this.applyQualityTier(this.governor.level);

    this.initMeshes();

    this.container.style.cursor = "default";
    this.container.addEventListener("pointerdown", this.onPointerDown);
    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerup", this.onPointerUp);

    this.rafHandle = requestAnimationFrame((t) => this.renderLoop(t));
  }

  private onGlLost = (e: Event): void => {
    e.preventDefault();
    this.isContextLost = true;
    this.reportGraphics();
  };

  private onGlRestored = (): void => {
    this.isContextLost = false;
    this.reportGraphics();
  };

  private reportGraphics(): void {
    this.options.onGraphics?.({
      adapter: this.adapter,
      level: this.activeTier,
      eased: this.activeTier < this.initialTier,
      lost: this.isContextLost,
    });
  }

  private applyQualityTier(targetLevel: number): void {
    if (targetLevel === this.activeTier) return;
    this.activeTier = targetLevel;
    const profile = LEVELS[this.activeTier]!;
    this.renderer.setPixelRatio(pixelRatioFor(profile, window.devicePixelRatio));
    this.post.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.post.setBloomScale(profile.bloom);
    this.onResize();
    if (this.cloudPoints) {
      this.cloudPoints.geometry.setDrawRange(0, Math.round(this.maxDustParticles * profile.particles));
    }
    this.reportGraphics();
  }

  private onResize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.post.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.fov = width / height < 1.2 ? 42 : 30;
    this.camera.updateProjectionMatrix();
  }

  private async initMeshes(): Promise<void> {
    try {
      const data = await loadBrain({
        meshUrl: this.options.meshUrl,
        structures: this.options.structures,
        dracoPath: this.options.dracoPath,
      });

      if (this.isDisposed) {
        data.geometry.dispose();
        return;
      }

      this.brainSurfaceMesh = new THREE.Mesh(data.geometry, brainMaterial(this.regionIllumination));
      this.cloudPoints = brainPoints(data.geometry, this.maxDustParticles, 7);

      const positions = cortexPlaces(data, this.options.memories.length);
      this.nodeCoordinates = positions;
      this.memoryNodePoints = memoryNodes(positions, this.options.memories);
      this.synapseLines = memoryThread(positions);

      this.brainPivot.add(this.brainSurfaceMesh, this.cloudPoints, this.synapseLines, this.memoryNodePoints);
      this.sessionStartSec = performance.now() / 1000;
    } catch (err) {
      this.options.onError?.(err);
    }
  }

  private getEngineClock(): number {
    return this.sessionStartSec === null
      ? 0
      : performance.now() / 1000 - this.sessionStartSec + this.fastForwardSec;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if ((e.target as Element | null)?.closest?.("button")) return;
    this.pointerDrag = { x: e.clientX, angle: this.turntableAngle };
    this.container.setPointerCapture(e.pointerId);
    this.container.style.cursor = "grabbing";
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.pointerDrag) {
      this.turntableAngle = this.pointerDrag.angle + (e.clientX - this.pointerDrag.x) * 0.008;
      return;
    }

    if (this.nodeCoordinates.length === 0) return;
    const rect = this.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closestIdx = -1;
    let closestDistSq = PICK_HIT_PROXIMITY_PX * PICK_HIT_PROXIMITY_PX;

    const screenPos = new THREE.Vector3();
    for (let i = 0; i < this.nodeCoordinates.length; i++) {
      if (this.presenceBuffer[i]! < 0.2) continue;
      screenPos
        .copy(this.nodeCoordinates[i]!)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.turntableAngle)
        .add(this.brainPivot.position)
        .project(this.camera);

      const sx = ((screenPos.x + 1) * 0.5) * rect.width;
      const sy = ((-screenPos.y + 1) * 0.5) * rect.height;
      const dx = sx - mouseX;
      const dy = sy - mouseY;
      const distSq = dx * dx + dy * dy;

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestIdx = i;
      }
    }

    if (closestIdx !== this.hoveredMemoryIdx) {
      this.hoveredMemoryIdx = closestIdx;
      this.options.onHover?.(closestIdx >= 0 ? this.options.memories[closestIdx]!.key : null);
      this.container.style.cursor = closestIdx >= 0 ? "pointer" : "default";
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const wasDragging = this.pointerDrag && Math.abs(e.clientX - this.pointerDrag.x) > 4;
    this.pointerDrag = null;
    this.container.style.cursor = this.hoveredMemoryIdx >= 0 ? "pointer" : "default";

    if (!wasDragging && this.hoveredMemoryIdx >= 0) {
      const selected = this.options.memories[this.hoveredMemoryIdx]!.key;
      this.selectedMemoryIdx = this.hoveredMemoryIdx;
      this.options.onSelect?.(selected);
    }
  };

  private renderLoop(timeMs: number): void {
    if (this.isDisposed) return;
    this.rafHandle = requestAnimationFrame((t) => this.renderLoop(t));

    const nowSec = timeMs / 1000;
    const dt = Math.min(0.1, this.lastRenderTime > 0 ? nowSec - this.lastRenderTime : 0.016);
    this.lastRenderTime = nowSec;

    this.governor.sample(dt);
    if (this.governor.level !== this.activeTier) {
      this.applyQualityTier(this.governor.level);
    }

    const t = this.getEngineClock();
    const bootT = easeCubic(t / STAGES.boot);
    const deployT = easeCubic((t - STAGES.boot) / STAGES.deploy);
    const materializeT = easeCubic((t - STAGES.boot - STAGES.deploy) / STAGES.materialize);

    let currentPhase: LabPhase = "boot";
    let mappedCount = 0;

    if (t < STAGES.boot) {
      currentPhase = "boot";
    } else if (t < STAGES.boot + STAGES.deploy) {
      currentPhase = "deploy";
    } else if (t < this.introSpan) {
      currentPhase = "materialize";
    } else if (t < this.totalIntroSequence) {
      currentPhase = "mapping";
      const progress = (t - this.introSpan) / this.mappingPeriod;
      mappedCount = Math.floor(progress * this.memoryCount);
    } else {
      currentPhase = "live";
      mappedCount = this.memoryCount;
    }

    if (currentPhase !== this.lastEmittedPhase || mappedCount !== this.lastEmittedCount) {
      this.lastEmittedPhase = currentPhase;
      this.lastEmittedCount = mappedCount;
      this.options.onPhase?.(currentPhase, mappedCount);
    }

    // Camera Framing with Margins
    const marginCenterOffset = (this.margins.left - this.margins.right) * 0.001;
    this.smoothCameraTarget.x += (marginCenterOffset - this.smoothCameraTarget.x) * 0.08;
    this.camera.position.x = this.smoothCameraTarget.x;
    this.camera.position.y = 0.25;
    this.camera.position.z = 2.4;
    this.camera.lookAt(this.smoothCameraTarget.x, 0.1, 0);

    const spinRate = this.isReducedMotion ? 0.001 : 0.002;
    if (!this.pointerDrag) {
      this.turntableAngle += spinRate;
    }
    this.brainPivot.rotation.y = this.turntableAngle;

    // Erase transitions
    for (const [idx, tr] of this.activeEraseTransitions) {
      const elapsed = nowSec - tr.started;
      const p = Math.min(1, elapsed / ERASE_TRANSITION_SEC);
      this.presenceBuffer[idx] = tr.from + (tr.to - tr.from) * p;
      if (p >= 1) this.activeEraseTransitions.delete(idx);
    }

    if (this.synapseLines) {
      updateThreadPresence(this.synapseLines, this.presenceBuffer);
    }

    if (this.memoryNodePoints) {
      const u = this.memoryNodePoints.material.uniforms;
      u.uTime!.value = nowSec;
      u.uHovered!.value = this.hoveredMemoryIdx;
      u.uSelected!.value = this.selectedMemoryIdx;
    }

    for (const child of this.baseProjector.children) {
      const u = ((child as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
      u.uFade!.value = bootT;
      u.uTime!.value = nowSec;
    }

    if (this.brainSurfaceMesh && this.cloudPoints) {
      const sU = this.brainSurfaceMesh.material.uniforms;
      sU.uTime!.value = nowSec;
      sU.uReveal!.value = materializeT;
      sU.uFade!.value = 1.0;

      const dU = this.cloudPoints.material.uniforms;
      dU.uTime!.value = nowSec;
      dU.uAssemble!.value = deployT;
    }

    this.post.composer.render(dt);
  }

  public select(key: string | null): void {
    this.selectedMemoryIdx = key === null ? -1 : (this.memoryKeyIndex.get(key) ?? -1);
  }

  public erase(key: string): void {
    const idx = this.memoryKeyIndex.get(key);
    if (idx !== undefined && idx >= 0) {
      this.activeEraseTransitions.set(idx, {
        from: this.presenceBuffer[idx]!,
        to: 0,
        started: performance.now() / 1000,
      });
    }
  }

  public restore(key: string): void {
    const idx = this.memoryKeyIndex.get(key);
    if (idx !== undefined && idx >= 0) {
      this.activeEraseTransitions.set(idx, {
        from: this.presenceBuffer[idx]!,
        to: 1,
        started: performance.now() / 1000,
      });
    }
  }

  public screenPosition(key: string): { x: number; y: number } | null {
    const idx = this.memoryKeyIndex.get(key);
    if (idx === undefined || idx < 0 || !this.nodeCoordinates[idx]) return null;
    const v = new THREE.Vector3()
      .copy(this.nodeCoordinates[idx]!)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.turntableAngle)
      .add(this.brainPivot.position)
      .project(this.camera);

    const rect = this.container.getBoundingClientRect();
    return {
      x: ((v.x + 1) * 0.5) * rect.width,
      y: ((-v.y + 1) * 0.5) * rect.height,
    };
  }

  public skipIntro(): void {
    if (this.sessionStartSec !== null && this.getEngineClock() < this.totalIntroSequence) {
      this.fastForwardSec += this.totalIntroSequence - this.getEngineClock();
    }
  }

  public setFocus(newMargins: FocusMargins): void {
    this.margins = newMargins;
  }

  public addLayer(layer: SceneLayer): () => void {
    this.registeredPassLayers.add(layer);
    return () => {
      this.registeredPassLayers.delete(layer);
    };
  }

  public setFilm(on: boolean): void {
    this.post.setFilm(on);
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.rafHandle);
    this.resizeObserver.disconnect();

    this.renderer.domElement.removeEventListener("webglcontextlost", this.onGlLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.onGlRestored);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerup", this.onPointerUp);

    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.regionIllumination.dispose();

    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) {
        mat.forEach((x) => x.dispose());
      } else {
        mat?.dispose();
      }
    });
  }
}

export function createMemoryScene(
  container: HTMLElement,
  options: MemorySceneOptions,
): MemoryScene {
  return new MemoryViewportEngine(container, options);
}

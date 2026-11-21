/**
 * HOOMAAN Memory Laboratory - Interactive 3D Neural Viewport Engine
 *
 * Clean-room implementation managing the memory constellation,
 * synaptic pathways, adaptive quality governor, and interactive raycasting.
 */

import * as THREE from "three";

import { loadBrain } from "./brainLoader";
import { floorGrid, orbitRings, projector } from "./environment";
import { brainMaterial, brainPoints, RegionLight } from "./hologram";
import { nameplate } from "./nameplate";
import { createPost } from "./post";
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

export function createMemoryScene(
  container: HTMLElement,
  options: MemorySceneOptions,
): MemoryScene {
  const isReduced =
    options.reducedMotion ??
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

  const memoryCount = options.memories.length;
  const memoryKeyIndex = new Map(options.memories.map((m, i) => [m.key, i]));
  const mappingPeriod = Math.min(MAX_MAPPING_SEC, Math.max(MIN_MAPPING_SEC, memoryCount * 0.22));
  const introSpan = STAGES.boot + STAGES.deploy + STAGES.materialize;
  const totalIntroSequence = introSpan + mappingPeriod;

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x010408, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "ml-gl";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
  const post = createPost(renderer, scene, camera);

  const adapter = classifyAdapter(detectGpuString(renderer));
  const initialTier = startingLevel(adapter);
  const governor = new FrameGovernor(initialTier);

  let activeTier = -1;
  let isContextLost = false;

  function reportGraphics(): void {
    options.onGraphics?.({
      adapter,
      level: activeTier,
      eased: activeTier < initialTier,
      lost: isContextLost,
    });
  }

  function applyQualityTier(targetLevel: number): void {
    if (targetLevel === activeTier) return;
    activeTier = targetLevel;
    const profile = LEVELS[activeTier]!;
    renderer.setPixelRatio(pixelRatioFor(profile, window.devicePixelRatio));
    post.composer.setPixelRatio(renderer.getPixelRatio());
    post.setBloomScale(profile.bloom);
    onContainerResize();
    if (cloudPoints) {
      cloudPoints.geometry.setDrawRange(0, Math.round(maxDustParticles * profile.particles));
    }
    reportGraphics();
  }

  function onGlLost(e: Event): void {
    e.preventDefault();
    isContextLost = true;
    reportGraphics();
  }

  function onGlRestored(): void {
    isContextLost = false;
    reportGraphics();
  }

  renderer.domElement.addEventListener("webglcontextlost", onGlLost);
  renderer.domElement.addEventListener("webglcontextrestored", onGlRestored);

  const registeredPassLayers = new Set<SceneLayer>();
  const layerPass = new LayerPass(
    registeredPassLayers,
    container,
    () => performance.now() / 1000,
    () => LEVELS[Math.max(0, activeTier)]!.particles,
  );
  post.composer.insertPass(layerPass, 1);

  // Scenery props
  const grid = floorGrid();
  const baseProjector = projector();
  const rings = orbitRings();
  const brainPivot = new THREE.Group();
  const signMesh = nameplate();
  scene.add(grid, baseProjector, rings, brainPivot, signMesh);

  let brainSurfaceMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let cloudPoints: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let memoryNodePoints: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let synapseLines: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;

  let nodeCoordinates: THREE.Vector3[] = [];
  const presenceBuffer = new Float32Array(Math.max(1, memoryCount)).fill(1);
  const activeEraseTransitions = new Map<number, { from: number; to: number; started: number }>();
  const regionIllumination = new RegionLight(1);

  let sessionStartSec: number | null = null;
  let fastForwardSec = 0;
  let hoveredMemoryIdx = -1;
  let selectedMemoryIdx = -1;
  let turntableAngle = 0;

  let margins: FocusMargins = { left: 0, right: 0, top: 0, bottom: 0 };
  const smoothCameraTarget = { x: 0, y: 0, zoom: 1 };

  let lastEmittedPhase: LabPhase | null = null;
  let lastEmittedCount = -1;
  let disposed = false;
  let rafHandle = 0;
  let lastRenderTime = 0;

  const maxDustParticles = isReduced ? 10000 : 20000;

  function onContainerResize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    post.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = width / height < 1.2 ? 42 : 30;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(onContainerResize);
  resizeObserver.observe(container);
  applyQualityTier(governor.level);

  // Mesh initialization
  (async () => {
    try {
      const data = await loadBrain({
        meshUrl: options.meshUrl,
        structures: options.structures,
        dracoPath: options.dracoPath,
      });

      if (disposed) {
        data.geometry.dispose();
        return;
      }

      brainSurfaceMesh = new THREE.Mesh(data.geometry, brainMaterial(regionIllumination));
      cloudPoints = brainPoints(data.geometry, maxDustParticles, 7);

      const positions = cortexPlaces(data, options.memories.length);
      nodeCoordinates = positions;
      memoryNodePoints = memoryNodes(positions, options.memories);
      synapseLines = memoryThread(positions);

      brainPivot.add(brainSurfaceMesh, cloudPoints, synapseLines, memoryNodePoints);
      sessionStartSec = performance.now() / 1000;
    } catch (err) {
      options.onError?.(err);
    }
  })();

  function getEngineClock(): number {
    return sessionStartSec === null
      ? 0
      : performance.now() / 1000 - sessionStartSec + fastForwardSec;
  }

  // Pointer drag & hover interaction
  let pointerDrag: { x: number; angle: number } | null = null;
  container.style.cursor = "default";

  function onPointerDown(e: PointerEvent): void {
    if ((e.target as Element | null)?.closest?.("button")) return;
    pointerDrag = { x: e.clientX, angle: turntableAngle };
    container.setPointerCapture(e.pointerId);
    container.style.cursor = "grabbing";
  }

  function onPointerMove(e: PointerEvent): void {
    if (pointerDrag) {
      turntableAngle = pointerDrag.angle + (e.clientX - pointerDrag.x) * 0.008;
      return;
    }

    if (nodeCoordinates.length === 0) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closestIdx = -1;
    let closestDistSq = PICK_HIT_PROXIMITY_PX * PICK_HIT_PROXIMITY_PX;

    const screenPos = new THREE.Vector3();
    for (let i = 0; i < nodeCoordinates.length; i++) {
      if (presenceBuffer[i]! < 0.2) continue;
      screenPos
        .copy(nodeCoordinates[i]!)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), turntableAngle)
        .add(brainPivot.position)
        .project(camera);

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

    if (closestIdx !== hoveredMemoryIdx) {
      hoveredMemoryIdx = closestIdx;
      options.onHover?.(closestIdx >= 0 ? options.memories[closestIdx]!.key : null);
      container.style.cursor = closestIdx >= 0 ? "pointer" : "default";
    }
  }

  function onPointerUp(e: PointerEvent): void {
    const wasDragging = pointerDrag && Math.abs(e.clientX - pointerDrag.x) > 4;
    pointerDrag = null;
    container.style.cursor = hoveredMemoryIdx >= 0 ? "pointer" : "default";

    if (!wasDragging && hoveredMemoryIdx >= 0) {
      const selected = options.memories[hoveredMemoryIdx]!.key;
      selectedMemoryIdx = hoveredMemoryIdx;
      options.onSelect?.(selected);
    }
  }

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);

  // Render loop
  function loop(timeMs: number): void {
    rafHandle = requestAnimationFrame(loop);
    const nowSec = timeMs / 1000;
    const dt = Math.min(0.1, lastRenderTime > 0 ? nowSec - lastRenderTime : 0.016);
    lastRenderTime = nowSec;

    governor.sample(dt);
    if (governor.level !== activeTier) {
      applyQualityTier(governor.level);
    }

    const t = getEngineClock();
    const bootT = easeCubic(t / STAGES.boot);
    const deployT = easeCubic((t - STAGES.boot) / STAGES.deploy);
    const materializeT = easeCubic((t - STAGES.boot - STAGES.deploy) / STAGES.materialize);

    let currentPhase: LabPhase = "boot";
    let mappedCount = 0;

    if (t < STAGES.boot) {
      currentPhase = "boot";
    } else if (t < STAGES.boot + STAGES.deploy) {
      currentPhase = "deploy";
    } else if (t < introSpan) {
      currentPhase = "materialize";
    } else if (t < totalIntroSequence) {
      currentPhase = "mapping";
      const progress = (t - introSpan) / mappingPeriod;
      mappedCount = Math.floor(progress * memoryCount);
    } else {
      currentPhase = "live";
      mappedCount = memoryCount;
    }

    if (currentPhase !== lastEmittedPhase || mappedCount !== lastEmittedCount) {
      lastEmittedPhase = currentPhase;
      lastEmittedCount = mappedCount;
      options.onPhase?.(currentPhase, mappedCount);
    }

    // Camera Framing with Margins
    const marginCenterOffset = (margins.left - margins.right) * 0.001;
    smoothCameraTarget.x += (marginCenterOffset - smoothCameraTarget.x) * 0.08;
    camera.position.x = smoothCameraTarget.x;
    camera.position.y = 0.25;
    camera.position.z = 2.4;
    camera.lookAt(smoothCameraTarget.x, 0.1, 0);

    const spinRate = isReduced ? 0.001 : 0.002;
    if (!pointerDrag) {
      turntableAngle += spinRate;
    }
    brainPivot.rotation.y = turntableAngle;

    // Erase transitions
    for (const [idx, tr] of activeEraseTransitions) {
      const elapsed = nowSec - tr.started;
      const p = Math.min(1, elapsed / ERASE_TRANSITION_SEC);
      presenceBuffer[idx] = tr.from + (tr.to - tr.from) * p;
      if (p >= 1) activeEraseTransitions.delete(idx);
    }

    if (synapseLines) {
      updateThreadPresence(synapseLines, presenceBuffer);
    }

    if (memoryNodePoints) {
      const u = memoryNodePoints.material.uniforms;
      u.uTime!.value = nowSec;
      u.uHovered!.value = hoveredMemoryIdx;
      u.uSelected!.value = selectedMemoryIdx;
    }

    for (const child of baseProjector.children) {
      const u = ((child as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
      u.uFade!.value = bootT;
      u.uTime!.value = nowSec;
    }

    if (brainSurfaceMesh && cloudPoints) {
      const sU = brainSurfaceMesh.material.uniforms;
      sU.uTime!.value = nowSec;
      sU.uReveal!.value = materializeT;
      sU.uFade!.value = 1.0;

      const dU = cloudPoints.material.uniforms;
      dU.uTime!.value = nowSec;
      dU.uAssemble!.value = deployT;
    }

    post.composer.render(dt);
  }

  rafHandle = requestAnimationFrame(loop);

  return {
    select(key: string | null) {
      selectedMemoryIdx = key === null ? -1 : (memoryKeyIndex.get(key) ?? -1);
    },

    erase(key: string) {
      const idx = memoryKeyIndex.get(key);
      if (idx !== undefined && idx >= 0) {
        activeEraseTransitions.set(idx, {
          from: presenceBuffer[idx]!,
          to: 0,
          started: performance.now() / 1000,
        });
      }
    },

    restore(key: string) {
      const idx = memoryKeyIndex.get(key);
      if (idx !== undefined && idx >= 0) {
        activeEraseTransitions.set(idx, {
          from: presenceBuffer[idx]!,
          to: 1,
          started: performance.now() / 1000,
        });
      }
    },

    screenPosition(key: string) {
      const idx = memoryKeyIndex.get(key);
      if (idx === undefined || idx < 0 || !nodeCoordinates[idx]) return null;
      const v = new THREE.Vector3()
        .copy(nodeCoordinates[idx]!)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), turntableAngle)
        .add(brainPivot.position)
        .project(camera);

      const rect = container.getBoundingClientRect();
      return {
        x: ((v.x + 1) * 0.5) * rect.width,
        y: ((-v.y + 1) * 0.5) * rect.height,
      };
    },

    skipIntro() {
      if (sessionStartSec !== null && getEngineClock() < totalIntroSequence) {
        fastForwardSec += totalIntroSequence - getEngineClock();
      }
    },

    setFocus(newMargins: FocusMargins) {
      margins = newMargins;
    },

    addLayer(layer: SceneLayer) {
      registeredPassLayers.add(layer);
      return () => {
        registeredPassLayers.delete(layer);
      };
    },

    setFilm(on: boolean) {
      post.setFilm(on);
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(rafHandle);
      resizeObserver.disconnect();

      renderer.domElement.removeEventListener("webglcontextlost", onGlLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onGlRestored);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);

      post.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      regionIllumination.dispose();

      scene.traverse((o) => {
        const m = o as THREE.Mesh;
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

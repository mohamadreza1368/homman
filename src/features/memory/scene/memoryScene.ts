import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";

import { placeOnCortex, type MemoryKind } from "../memories";
import { loadBrain, type Brain, type BrainStructure } from "./brainLoader";
import { floorGrid, orbitRings, projector } from "./environment";
import { brainMaterial, brainPoints, LOOK, RegionLight } from "./hologram";
import { floatName, nameplate } from "./nameplate";
import { createPost } from "./post";
import { classifyAdapter, FrameGovernor, LEVELS, pixelRatioFor, startingLevel, type Adapter } from "./quality";

export type LabPhase = "boot" | "deploy" | "materialize" | "mapping" | "live";

export interface GraphicsStatus {
  adapter: Adapter;
  level: number;
  eased: boolean;
  lost: boolean;
}

export interface SceneMemory {
  key: string;
  kind: MemoryKind;
}

export interface MemorySceneOptions {
  meshUrl: string;
  structures: readonly BrainStructure[];
  dracoPath: string;
  memories: readonly SceneMemory[];
  reducedMotion?: boolean;
  onHover?: (key: string | null) => void;
  onSelect?: (key: string | null) => void;
  onPhase?: (phase: LabPhase, mapped: number) => void;
  onError?: (error: unknown) => void;
  onGraphics?: (status: GraphicsStatus) => void;
}

export interface FocusMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface SceneLayer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rect(): { left: number; top: number; width: number; height: number } | null;
  update(now: number, aspect: number, pixelRatio: number, particles: number): void;
}

export interface MemoryScene {
  select(key: string | null): void;
  erase(key: string): void;
  restore(key: string): void;
  screenPosition(key: string): { x: number; y: number } | null;
  skipIntro(): void;
  setFocus(margins: FocusMargins): void;
  addLayer(layer: SceneLayer): () => void;
  setFilm(on: boolean): void;
  dispose(): void;
}

const STAGES = { boot: 1.1, deploy: 2.4, materialize: 1.4 } as const;
const DURATION_PER_MEMORY_SEC = 0.22;
const MIN_MAPPING_SEC = 3.0;
const MAX_MAPPING_SEC = 12.0;
const PICK_HIT_PROXIMITY_PX = 18;
const ERASE_TRANSITION_SEC = 1.6;
const BURST_PARTICLE_COUNT = 240;
const TARGET_FRAME_RADIUS = 1.4;
const THREAD_SUBDIVISIONS = 14;

const PALETTE: Record<MemoryKind, THREE.Color> = {
  session: new THREE.Color("#56e1ff"),
  case: new THREE.Color("#ffb347"),
  note: new THREE.Color("#c29bff"),
};

const easeCubic = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return c * c * (3 - 2 * c);
};

export function createMemoryScene(container: HTMLElement, opts: MemorySceneOptions): MemoryScene {
  const isReducedMotion =
    opts.reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const totalCount = opts.memories.length;
  const keyToIndexMap = new Map(opts.memories.map((m, i) => [m.key, i]));
  const mappingPeriodSec = Math.min(
    MAX_MAPPING_SEC,
    Math.max(MIN_MAPPING_SEC, totalCount * DURATION_PER_MEMORY_SEC),
  );
  const introEndSec = STAGES.boot + STAGES.deploy + STAGES.materialize;
  const sequenceEndSec = introEndSec + mappingPeriodSec;

  const webglRenderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  webglRenderer.setClearColor(0x010408, 1);
  webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
  webglRenderer.domElement.className = "ml-gl";
  container.appendChild(webglRenderer.domElement);

  const mainScene = new THREE.Scene();
  const mainCamera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
  const postPipeline = createPost(webglRenderer, mainScene, mainCamera);

  const detectedAdapter = classifyAdapter(queryRendererDescription(webglRenderer));
  const maxTier = startingLevel(detectedAdapter);
  const frameGovernor = new FrameGovernor(maxTier);

  let currentTier = -1;
  let contextDropped = false;

  const dispatchGraphicsReport = () =>
    opts.onGraphics?.({
      adapter: detectedAdapter,
      level: currentTier,
      eased: currentTier < maxTier,
      lost: contextDropped,
    });

  const applyTierSettings = (nextTier: number) => {
    if (nextTier === currentTier) return;
    currentTier = nextTier;
    const settings = LEVELS[currentTier]!;
    webglRenderer.setPixelRatio(pixelRatioFor(settings, window.devicePixelRatio));
    postPipeline.composer.setPixelRatio(webglRenderer.getPixelRatio());
    postPipeline.setBloomScale(settings.bloom);
    handleResize();
    if (ambientDust) {
      ambientDust.geometry.setDrawRange(0, Math.round(dustCapacity * settings.particles));
    }
    dispatchGraphicsReport();
  };

  const handleContextLost = (e: Event) => {
    e.preventDefault();
    contextDropped = true;
    dispatchGraphicsReport();
  };

  const handleContextRestored = () => {
    contextDropped = false;
    dispatchGraphicsReport();
  };

  webglRenderer.domElement.addEventListener("webglcontextlost", handleContextLost);
  webglRenderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);

  const registeredLayers = new Set<SceneLayer>();
  const layerRenderPass = new LayerPass(
    registeredLayers,
    container,
    () => performance.now() / 1000,
    () => LEVELS[Math.max(0, currentTier)]!.particles,
  );
  postPipeline.composer.insertPass(layerRenderPass, 1);

  const floorGridMesh = floorGrid();
  const floorProjector = projector();
  const telemetryRings = orbitRings();
  const stageAnchor = new THREE.Group();
  const titleMesh = nameplate();

  mainScene.add(floorGridMesh, floorProjector, telemetryRings, stageAnchor, titleMesh);

  let brainModel: Brain | null = null;
  let corticalSurface: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let ambientDust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let nodePoints: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let synapticThread: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let eraseBurstMesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;

  let coordinateNodes: THREE.Vector3[] = [];
  const presenceArray = new Float32Array(Math.max(1, totalCount)).fill(1);
  const activeEraseTransitions = new Map<number, { from: number; to: number; started: number }>();
  const illuminationController = new RegionLight(1);

  let startEpochSec: number | null = null;
  let timelineSkipSec = 0;
  let currentHoveredIndex = -1;
  let currentSelectedIndex = -1;
  let currentRotationAngle = 0;

  let viewportMargins: FocusMargins = { left: 0, right: 0, top: 0, bottom: 0 };
  const smoothFraming = { x: 0, y: 0, zoom: 1 };

  let previousPhase: LabPhase | null = null;
  let previousMappedCount = -1;
  let isTornDown = false;
  let animationFrameId = 0;
  let lastFrameEpoch = 0;

  const dustCapacity = isReducedMotion ? 10000 : 20000;

  const handleResize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    webglRenderer.setSize(w, h, false);
    postPipeline.setSize(w, h);
    mainCamera.aspect = w / h;
    mainCamera.fov = w / h < 1.2 ? 42 : 30;
    mainCamera.updateProjectionMatrix();
  };

  const containerObserver = new ResizeObserver(handleResize);
  containerObserver.observe(container);
  applyTierSettings(frameGovernor.level);

  (async () => {
    try {
      const loadedData = await loadBrain({
        meshUrl: opts.meshUrl,
        structures: opts.structures,
        dracoPath: opts.dracoPath,
      });

      if (isTornDown) {
        loadedData.geometry.dispose();
        return;
      }

      brainModel = loadedData;
      corticalSurface = new THREE.Mesh(brainModel.geometry, brainMaterial(illuminationController));
      ambientDust = brainPoints(brainModel.geometry, dustCapacity);
      ambientDust.geometry.setDrawRange(
        0,
        Math.round(dustCapacity * LEVELS[currentTier]!.particles),
      );
      ambientDust.material.uniforms.uRegions!.value = illuminationController.texture;
      stageAnchor.add(corticalSurface, ambientDust);

      coordinateNodes = cortexPlaces(brainModel, totalCount);
      nodePoints = memoryNodes(coordinateNodes, opts.memories);
      synapticThread = memoryThread(coordinateNodes);
      eraseBurstMesh = eraseBurst();

      stageAnchor.add(synapticThread, nodePoints, eraseBurstMesh);
      startEpochSec = performance.now() / 1000;
    } catch (e) {
      opts.onError?.(e);
    }
  })();

  let pointerDrag: { x: number; y: number; baseSpin: number } | null = null;
  let hasDragged = false;

  const toLocalCoords = (evt: PointerEvent) => {
    const bounds = webglRenderer.domElement.getBoundingClientRect();
    return { x: evt.clientX - bounds.left, y: evt.clientY - bounds.top };
  };

  const findClosestNode = (pxX: number, pxY: number): number => {
    let closestIndex = -1;
    let minDistance = PICK_HIT_PROXIMITY_PX;

    coordinateNodes.forEach((_, idx) => {
      if (presenceArray[idx]! < 0.5 || !isMappedByNow(idx)) return;
      const screenLoc = projectVertex(idx);
      if (!screenLoc) return;
      const dist = Math.hypot(screenLoc.x - pxX, screenLoc.y - pxY);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    return closestIndex;
  };

  const handlePointerDown = (evt: PointerEvent) => {
    const loc = toLocalCoords(evt);
    pointerDrag = { x: loc.x, y: loc.y, baseSpin: currentRotationAngle };
    hasDragged = false;
  };

  const handlePointerMove = (evt: PointerEvent) => {
    const loc = toLocalCoords(evt);
    if (pointerDrag) {
      const deltaX = loc.x - pointerDrag.x;
      if (Math.abs(deltaX) > 4) {
        hasDragged = true;
      }
      if (hasDragged) {
        currentRotationAngle = pointerDrag.baseSpin + deltaX * 0.006;
      }
      return;
    }

    const hoveredIdx = findClosestNode(loc.x, loc.y);
    if (hoveredIdx !== currentHoveredIndex) {
      currentHoveredIndex = hoveredIdx;
      webglRenderer.domElement.style.cursor = hoveredIdx >= 0 ? "pointer" : "grab";
      opts.onHover?.(hoveredIdx >= 0 ? opts.memories[hoveredIdx]!.key : null);
    }
  };

  const handlePointerUp = (evt: PointerEvent) => {
    if (!pointerDrag) return;
    const didDrag = hasDragged;
    pointerDrag = null;
    hasDragged = false;
    if (didDrag) return;

    const loc = toLocalCoords(evt);
    const selectedIdx = findClosestNode(loc.x, loc.y);
    currentSelectedIndex = selectedIdx;
    opts.onSelect?.(selectedIdx >= 0 ? opts.memories[selectedIdx]!.key : null);
  };

  const domCanvas = webglRenderer.domElement;
  domCanvas.style.cursor = "grab";
  domCanvas.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);

  const projectedV = new THREE.Vector3();
  function projectVertex(nodeIdx: number): { x: number; y: number } | null {
    const nodePos = coordinateNodes[nodeIdx];
    if (!nodePos) return null;

    projectedV.copy(nodePos).applyMatrix4(stageAnchor.matrixWorld).project(mainCamera);
    if (projectedV.z > 1) return null;

    return {
      x: (projectedV.x * 0.5 + 0.5) * container.clientWidth,
      y: (-projectedV.y * 0.5 + 0.5) * container.clientHeight,
    };
  }

  function getElapsedTimeSec(): number {
    return startEpochSec === null ? 0 : performance.now() / 1000 - startEpochSec + timelineSkipSec;
  }

  function getCalculatedMappedCount(t: number): number {
    if (t < introEndSec) return 0;
    return Math.min(totalCount, Math.floor(((t - introEndSec) / mappingPeriodSec) * totalCount) + 1);
  }

  function isMappedByNow(idx: number): boolean {
    return idx < getCalculatedMappedCount(getElapsedTimeSec());
  }

  function computeFramingProjection(vpWidth: number, vpHeight: number) {
    const availableW = Math.max(120, vpWidth - viewportMargins.left - viewportMargins.right);
    const availableH = Math.max(120, vpHeight - viewportMargins.top - viewportMargins.bottom);
    const midX = viewportMargins.left + availableW * 0.5;
    const midY = viewportMargins.top + availableH * 0.5;

    const camDistance = mainCamera.position.length();
    const pxPerUnit = vpHeight / (2 * Math.tan(THREE.MathUtils.degToRad(mainCamera.fov) * 0.5) * camDistance);
    const boundingRequirement = TARGET_FRAME_RADIUS * 2 * pxPerUnit;
    const targetZoom = Math.min(1, Math.max(0.45, Math.min(availableW, availableH) / boundingRequirement));

    const easeAlpha = 0.08;
    smoothFraming.x += (vpWidth * 0.5 - midX - smoothFraming.x) * easeAlpha;
    smoothFraming.y += (vpHeight * 0.5 - midY - smoothFraming.y) * easeAlpha;
    smoothFraming.zoom += (targetZoom - smoothFraming.zoom) * easeAlpha;

    mainCamera.zoom = smoothFraming.zoom;
    mainCamera.setViewOffset(vpWidth, vpHeight, smoothFraming.x, smoothFraming.y, vpWidth, vpHeight);
    mainCamera.updateProjectionMatrix();
  }

  const renderLoop = () => {
    if (isTornDown) return;
    animationFrameId = requestAnimationFrame(renderLoop);

    const nowSec = performance.now() / 1000;
    const elapsedSec = getElapsedTimeSec();

    const dtMs = (nowSec - lastFrameEpoch) * 1000;
    lastFrameEpoch = nowSec;

    if (startEpochSec !== null && elapsedSec > STAGES.boot && !contextDropped) {
      const nextQuality = frameGovernor.sample(dtMs);
      if (nextQuality !== null) {
        applyTierSettings(nextQuality);
      }
    }

    const currentPhase: LabPhase =
      startEpochSec === null || elapsedSec < STAGES.boot
        ? "boot"
        : elapsedSec < STAGES.boot + STAGES.deploy
          ? "deploy"
          : elapsedSec < introEndSec
            ? "materialize"
            : elapsedSec < sequenceEndSec
              ? "mapping"
              : "live";

    const mappedTotal = getCalculatedMappedCount(elapsedSec);
    if (currentPhase !== previousPhase || mappedTotal !== previousMappedCount) {
      previousPhase = currentPhase;
      previousMappedCount = mappedTotal;
      opts.onPhase?.(currentPhase, mappedTotal);
    }

    const bootProgress = easeCubic(elapsedSec / STAGES.boot);
    const deployProgress = easeCubic((elapsedSec - STAGES.boot) / STAGES.deploy);
    const materializeProgress = easeCubic((elapsedSec - STAGES.boot - STAGES.deploy) / STAGES.materialize);

    floatName(titleMesh, mainCamera, nowSec, easeCubic((elapsedSec - STAGES.boot - 0.4) / 1.6));

    const motionMultiplier = isReducedMotion ? 0.35 : 1.0;
    const cameraOrbitRate = nowSec * 0.03 * motionMultiplier;

    mainCamera.position.set(
      Math.sin(cameraOrbitRate) * 0.8,
      0.45 + Math.sin(nowSec * 0.1) * 0.12,
      5.6,
    );
    mainCamera.lookAt(0, 0.02, 0);

    computeFramingProjection(container.clientWidth, container.clientHeight);

    if (!pointerDrag && currentHoveredIndex < 0 && currentSelectedIndex < 0) {
      currentRotationAngle += 0.0012 * motionMultiplier;
    }
    stageAnchor.rotation.y = currentRotationAngle;
    stageAnchor.updateMatrixWorld();

    const ambientElements: THREE.ShaderMaterial[] = [
      floorGridMesh.material as THREE.ShaderMaterial,
      ...(floorProjector.children.map((c) => (c as THREE.Mesh).material) as THREE.ShaderMaterial[]),
    ];
    for (const mat of ambientElements) {
      mat.uniforms.uFade!.value = bootProgress;
      mat.uniforms.uTime!.value = nowSec;
    }

    telemetryRings.children.forEach((ring, idx) => {
      ring.rotation.z = nowSec * (ring.userData.spin as number) * motionMultiplier + idx;
      const ringMat = (ring as THREE.LineLoop).material as THREE.ShaderMaterial;
      ringMat.uniforms.uFade!.value = deployProgress * 0.7;
      ringMat.uniforms.uTime!.value = nowSec;
    });

    if (brainModel && corticalSurface && ambientDust && nodePoints && synapticThread && eraseBurstMesh) {
      const surfaceUniforms = corticalSurface.material.uniforms;
      surfaceUniforms.uTime!.value = nowSec;
      surfaceUniforms.uReveal!.value = materializeProgress;
      surfaceUniforms.uScanOn!.value = currentPhase === "mapping" ? 1 : 0;
      surfaceUniforms.uCentre!.value = mainCamera.position.length();
      surfaceUniforms.uScanY!.value =
        brainModel.bottom + (brainModel.top - brainModel.bottom) * ((elapsedSec - introEndSec) / mappingPeriodSec);

      const dustUniforms = ambientDust.material.uniforms;
      dustUniforms.uTime!.value = nowSec;
      dustUniforms.uAssemble!.value = deployProgress;
      dustUniforms.uDust!.value = 1 - materializeProgress * 0.9;
      dustUniforms.uPixel!.value = webglRenderer.getPixelRatio() * (container.clientHeight / 900);

      if (activeEraseTransitions.size > 0) {
        const presenceBuffer = nodePoints.geometry.getAttribute("presence") as THREE.BufferAttribute;
        for (const [nodeIdx, trans] of activeEraseTransitions) {
          const k = easeCubic((nowSec - trans.started) / ERASE_TRANSITION_SEC);
          presenceArray[nodeIdx] = trans.from + (trans.to - trans.from) * k;
          presenceBuffer.setX(nodeIdx, presenceArray[nodeIdx]!);
          if (k >= 1) {
            activeEraseTransitions.delete(nodeIdx);
          }
        }
        presenceBuffer.needsUpdate = true;
        updateThreadPresence(synapticThread, presenceArray);
      }

      const nodeUniforms = nodePoints.material.uniforms;
      nodeUniforms.uTime!.value = nowSec;
      nodeUniforms.uShown!.value = currentPhase === "live" ? totalCount : mappedTotal;
      nodeUniforms.uHover!.value = currentHoveredIndex;
      nodeUniforms.uSelected!.value = currentSelectedIndex;
      nodeUniforms.uPixel!.value = webglRenderer.getPixelRatio();
      nodeUniforms.uFade!.value = materializeProgress;

      const threadUniforms = synapticThread.material.uniforms;
      threadUniforms.uShown!.value =
        currentPhase === "live"
          ? totalCount
          : Math.max(0, ((elapsedSec - introEndSec) / mappingPeriodSec) * totalCount);
      threadUniforms.uTime!.value = nowSec;
      threadUniforms.uFade!.value = materializeProgress;

      const burstUniforms = eraseBurstMesh.material.uniforms;
      burstUniforms.uTime!.value = nowSec;
      burstUniforms.uPixel!.value = webglRenderer.getPixelRatio();
    }

    (postPipeline.film.uniforms.uTime as { value: number }).value = nowSec;
    postPipeline.composer.render();
  };

  animationFrameId = requestAnimationFrame(renderLoop);

  return {
    select(key: string | null) {
      currentSelectedIndex = key === null ? -1 : (keyToIndexMap.get(key) ?? -1);
    },
    erase(key: string) {
      const idx = keyToIndexMap.get(key);
      if (idx === undefined || !eraseBurstMesh) return;
      const now = performance.now() / 1000;
      activeEraseTransitions.set(idx, { from: presenceArray[idx]!, to: 0, started: now });
      fireBurst(eraseBurstMesh, coordinateNodes[idx]!, now, PALETTE[opts.memories[idx]!.kind]);
      if (currentSelectedIndex === idx) {
        currentSelectedIndex = -1;
      }
    },
    restore(key: string) {
      const idx = keyToIndexMap.get(key);
      if (idx === undefined) return;
      activeEraseTransitions.set(idx, {
        from: presenceArray[idx]!,
        to: 1,
        started: performance.now() / 1000,
      });
    },
    screenPosition(key: string) {
      const idx = keyToIndexMap.get(key);
      return idx === undefined || presenceArray[idx]! < 0.3 ? null : projectVertex(idx);
    },
    setFocus(margins: FocusMargins) {
      viewportMargins = margins;
    },
    setFilm(enabled: boolean) {
      postPipeline.setFilm(enabled);
    },
    addLayer(layer: SceneLayer) {
      registeredLayers.add(layer);
      return () => registeredLayers.delete(layer);
    },
    skipIntro() {
      if (startEpochSec !== null && getElapsedTimeSec() < sequenceEndSec) {
        timelineSkipSec += sequenceEndSec - getElapsedTimeSec();
      }
    },
    dispose() {
      isTornDown = true;
      cancelAnimationFrame(animationFrameId);
      containerObserver.disconnect();

      domCanvas.removeEventListener("pointerdown", handlePointerDown);
      webglRenderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      webglRenderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      illuminationController.dispose();
      registeredLayers.clear();

      mainScene.traverse((node) => {
        const m = node as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) {
          mat.forEach((entry) => entry.dispose());
        } else {
          mat?.dispose();
        }
      });

      postPipeline.dispose();
      webglRenderer.dispose();
      domCanvas.remove();
    },
  };
}

function queryRendererDescription(renderer: THREE.WebGLRenderer): string | null {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {
    return null;
  }
}

class LayerPass extends Pass {
  constructor(
    private readonly layers: ReadonlySet<SceneLayer>,
    private readonly container: HTMLElement,
    private readonly timeProvider: () => number,
    private readonly particleShareProvider: () => number,
  ) {
    super();
    this.needsSwap = false;
    this.clear = false;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    _write: THREE.WebGLRenderTarget,
    read: THREE.WebGLRenderTarget,
  ): void {
    if (this.layers.size === 0) return;
    const viewW = Math.max(1, this.container.clientWidth);
    const viewH = Math.max(1, this.container.clientHeight);
    const pixelScaling = read.width / viewW;
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    for (const layer of this.layers) {
      const area = layer.rect();
      if (!area || area.width < 2 || area.height < 2) continue;

      layer.update(
        this.timeProvider(),
        area.width / area.height,
        pixelScaling,
        this.particleShareProvider(),
      );

      const x = Math.round(area.left * pixelScaling);
      const y = Math.round((viewH - area.top - area.height) * pixelScaling);
      const w = Math.round(area.width * pixelScaling);
      const h = Math.round(area.height * pixelScaling);

      read.viewport.set(x, y, w, h);
      read.scissor.set(x, y, w, h);
      read.scissorTest = true;

      renderer.setRenderTarget(this.renderToScreen ? null : read);
      renderer.clearDepth();
      renderer.render(layer.scene, layer.camera);
    }

    read.viewport.set(0, 0, read.width, read.height);
    read.scissor.set(0, 0, read.width, read.height);
    read.scissorTest = false;

    renderer.setRenderTarget(this.renderToScreen ? null : read);
    renderer.autoClear = previousAutoClear;
  }
}

function cortexPlaces(brain: Brain, memoryCount: number): THREE.Vector3[] {
  const posAttr = brain.geometry.getAttribute("position") as THREE.BufferAttribute;
  const regionAttr = brain.geometry.getAttribute("region") as THREE.BufferAttribute;
  const cerebrumIndices = new Set(
    brain.regions.map((r, idx) => (r.division === "Cerebrum" ? idx : -1)).filter((idx) => idx >= 0),
  );

  const decimationStep = Math.max(1, Math.floor(posAttr.count / 12000));
  const vertexPool: number[] = [];

  for (let v = 0; v < posAttr.count; v += decimationStep) {
    if (cerebrumIndices.size > 0 && !cerebrumIndices.has(regionAttr.getX(v))) {
      continue;
    }
    vertexPool.push(posAttr.getX(v), posAttr.getY(v), posAttr.getZ(v));
  }

  return placeOnCortex(memoryCount, vertexPool).map((pointIdx) =>
    new THREE.Vector3(
      vertexPool[pointIdx * 3]!,
      vertexPool[pointIdx * 3 + 1]!,
      vertexPool[pointIdx * 3 + 2]!,
    ).multiplyScalar(1.02),
  );
}

function memoryNodes(coords: THREE.Vector3[], memories: readonly SceneMemory[]) {
  const count = Math.max(1, coords.length);
  const positionBuffer = new Float32Array(count * 3);
  const colorBuffer = new Float32Array(count * 3);
  const orderBuffer = new Float32Array(count);
  const presenceBuffer = new Float32Array(count).fill(1);

  coords.forEach((p, idx) => {
    p.toArray(positionBuffer, idx * 3);
    PALETTE[memories[idx]!.kind].toArray(colorBuffer, idx * 3);
    orderBuffer[idx] = idx;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positionBuffer, 3));
  geo.setAttribute("colour", new THREE.BufferAttribute(colorBuffer, 3));
  geo.setAttribute("order", new THREE.BufferAttribute(orderBuffer, 1));
  geo.setAttribute("presence", new THREE.BufferAttribute(presenceBuffer, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uShown: { value: 0 },
      uHover: { value: -1 },
      uSelected: { value: -1 },
      uPixel: { value: 1 },
      uFade: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 colour;
      attribute float order;
      attribute float presence;
      uniform float uTime;
      uniform float uShown;
      uniform float uHover;
      uniform float uSelected;
      uniform float uPixel;
      uniform float uFade;
      varying vec3 vColour;
      varying float vAlpha;
      varying float vRing;

      void main() {
        float isShown = step(order, uShown - 0.5);
        float arrivingFlare = exp(-pow(max(0.0, uShown - 1.0 - order) * 1.6, 2.0));
        float isFocused = max(step(abs(order - uHover), 0.1), step(abs(order - uSelected), 0.1));
        vRing = step(abs(order - uSelected), 0.1);
        vColour = colour;

        float breathing = 0.85 + 0.15 * sin(uTime * 1.3 + order * 0.7);
        vAlpha = isShown * presence * uFade * breathing * (0.75 + 0.25 * isFocused);

        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uPixel * (10.0 + arrivingFlare * 10.0 + isFocused * 9.0 + vRing * 11.0) * (5.6 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColour;
      varying float vAlpha;
      varying float vRing;

      void main() {
        vec2 delta = gl_PointCoord - 0.5;
        float radius = length(delta) * 2.0;
        if (radius > 1.0) discard;

        float innerCore = exp(-radius * radius * 9.0);
        float peripheralGlow = exp(-radius * 3.4) * 0.22;
        float selectionRing = vRing * smoothstep(0.08, 0.0, abs(radius - 0.82));

        gl_FragColor = vec4(vColour * (innerCore + peripheralGlow + selectionRing) * vAlpha * 0.72, 1.0);
      }
    `,
  });

  return new THREE.Points(geo, mat);
}

function memoryThread(coords: THREE.Vector3[]) {
  const pairCount = Math.max(0, coords.length - 1);
  const vertexCount = Math.max(2, pairCount * THREAD_SUBDIVISIONS * 2);
  const vertexPositions = new Float32Array(vertexCount * 3);
  const progressAttributes = new Float32Array(vertexCount);
  const edgeIndices = new Float32Array(vertexCount * 2);
  const threadPresence = new Float32Array(vertexCount).fill(1);

  const sampleVec = new THREE.Vector3();

  for (let idx = 0; idx < pairCount; idx++) {
    const originP = coords[idx]!;
    const destP = coords[idx + 1]!;
    const centerP = originP.clone().add(destP).multiplyScalar(0.5);
    const elevatedApex = centerP.clone().normalize().multiplyScalar(0.06 + originP.distanceTo(destP) * 0.25);
    const bezierSpline = new THREE.QuadraticBezierCurve3(originP, centerP.add(elevatedApex), destP);

    for (let k = 0; k < THREAD_SUBDIVISIONS; k++) {
      const endpoints: readonly [number, number][] = [
        [0, k / THREAD_SUBDIVISIONS],
        [1, (k + 1) / THREAD_SUBDIVISIONS],
      ];
      for (const [slot, factor] of endpoints) {
        const vIdx = (idx * THREAD_SUBDIVISIONS + k) * 2 + slot;
        bezierSpline.getPoint(factor, sampleVec).toArray(vertexPositions, vIdx * 3);
        progressAttributes[vIdx] = idx + factor;
        edgeIndices[vIdx * 2] = idx;
        edgeIndices[vIdx * 2 + 1] = idx + 1;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertexPositions, 3));
  geometry.setAttribute("along", new THREE.BufferAttribute(progressAttributes, 1));
  geometry.setAttribute("ends", new THREE.BufferAttribute(edgeIndices, 2));
  geometry.setAttribute("presence", new THREE.BufferAttribute(threadPresence, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);

  const threadMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uShown: { value: 0 },
      uTime: { value: 0 },
      uFade: { value: 0 },
      uCyan: { value: LOOK.cyan },
    },
    vertexShader: /* glsl */ `
      attribute float along;
      attribute float presence;
      varying float vAlong;
      varying float vPresence;

      void main() {
        vAlong = along;
        vPresence = presence;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uShown;
      uniform float uTime;
      uniform float uFade;
      uniform vec3 uCyan;
      varying float vAlong;
      varying float vPresence;

      void main() {
        float leadingEdge = uShown - 1.0;
        if (vAlong > leadingEdge) discard;

        float headGlow = exp(-pow((leadingEdge - vAlong) * 3.0, 2.0));
        float travelingPulse = exp(-pow(mod(vAlong - uTime * 1.2, 24.0) - 12.0, 2.0) * 0.5) * 0.5;

        float alphaValue = (0.18 + headGlow * 0.8 + travelingPulse * 0.3) * vPresence * uFade;
        gl_FragColor = vec4(uCyan * alphaValue, 1.0);
      }
    `,
  });

  return new THREE.LineSegments(geometry, threadMat);
}

function updateThreadPresence(thread: THREE.LineSegments, presence: Float32Array) {
  const geo = thread.geometry;
  const edgesAttr = geo.getAttribute("ends") as THREE.BufferAttribute;
  const presenceAttr = geo.getAttribute("presence") as THREE.BufferAttribute;

  for (let v = 0; v < presenceAttr.count; v++) {
    presenceAttr.setX(
      v,
      Math.min(presence[edgesAttr.getX(v)] ?? 1, presence[edgesAttr.getY(v)] ?? 1),
    );
  }
  presenceAttr.needsUpdate = true;
}

function eraseBurst() {
  const coords = new Float32Array(BURST_PARTICLE_COUNT * 3);
  const velocityVectors = new Float32Array(BURST_PARTICLE_COUNT * 3);
  const randomSeeds = new Float32Array(BURST_PARTICLE_COUNT);

  for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    dir.toArray(velocityVectors, i * 3);
    randomSeeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(coords, 3));
  geometry.setAttribute("direction", new THREE.BufferAttribute(velocityVectors, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(randomSeeds, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  const burstMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uStart: { value: -100 },
      uOrigin: { value: new THREE.Vector3() },
      uColour: { value: new THREE.Color() },
      uPixel: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 direction;
      attribute float seed;
      uniform float uTime;
      uniform float uStart;
      uniform vec3 uOrigin;
      uniform float uPixel;
      varying float vAlpha;

      void main() {
        float lifetimeProgress = (uTime - uStart) / (1.2 + seed * 1.2);
        vAlpha = lifetimeProgress < 0.0 || lifetimeProgress > 1.0
          ? 0.0
          : (1.0 - lifetimeProgress) * (1.0 - lifetimeProgress);

        vec3 displacedPos = uOrigin + direction * (0.05 + seed * 0.5) * (1.0 - pow(1.0 - clamp(lifetimeProgress, 0.0, 1.0), 3.0));
        displacedPos.y += lifetimeProgress * lifetimeProgress * 0.15;

        vec4 mvPos = modelViewMatrix * vec4(displacedPos, 1.0);
        gl_PointSize = uPixel * (2.0 + seed * 3.0) * (5.6 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      varying float vAlpha;

      void main() {
        vec2 delta = gl_PointCoord - 0.5;
        if (dot(delta, delta) > 0.25) discard;
        gl_FragColor = vec4(uColour * vAlpha * 0.9, 1.0);
      }
    `,
  });

  return new THREE.Points(geometry, burstMat);
}

function fireBurst(burstPoints: THREE.Points, origin: THREE.Vector3, timestampSec: number, colorVal: THREE.Color) {
  const burstUniforms = (burstPoints.material as THREE.ShaderMaterial).uniforms;
  burstUniforms.uStart!.value = timestampSec;
  (burstUniforms.uOrigin!.value as THREE.Vector3).copy(origin);
  (burstUniforms.uColour!.value as THREE.Color).copy(colorVal);
}

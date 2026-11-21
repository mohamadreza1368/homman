import * as THREE from "three";

import { loadBrain, type Brain } from "./brainLoader";
import { floorGrid, orbitRings, projector } from "./environment";
import { brainMaterial, brainPoints, RegionLight } from "./hologram";
import { floatName, nameplate } from "./nameplate";
import { createPost } from "./post";
import { classifyAdapter, FrameGovernor, LEVELS, pixelRatioFor, startingLevel } from "./quality";
import {
  easeCubic,
  ERASE_TRANSITION_SEC,
  MAX_MAPPING_SEC,
  MIN_MAPPING_SEC,
  PALETTE,
  PICK_HIT_PROXIMITY_PX,
  STAGES,
  TARGET_FRAME_RADIUS,
  type FocusMargins,
  type LabPhase,
  type MemoryScene,
  type MemorySceneOptions,
  type SceneLayer,
} from "./memorySceneTypes";
import {
  cortexPlaces,
  eraseBurst,
  fireBurst,
  memoryNodes,
  memoryThread,
  updateThreadPresence,
} from "./memoryVisuals";
import { LayerPass } from "./LayerPass";

export * from "./memorySceneTypes";

function queryRendererDescription(renderer: THREE.WebGLRenderer): string | null {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch {
    return null;
  }
}

export function createMemoryScene(container: HTMLElement, opts: MemorySceneOptions): MemoryScene {
  const isReducedMotion =
    opts.reducedMotion ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const totalCount = opts.memories.length;
  const keyToIndexMap = new Map(opts.memories.map((m, i) => [m.key, i]));
  const mappingPeriodSec = Math.min(
    MAX_MAPPING_SEC,
    Math.max(MIN_MAPPING_SEC, totalCount * 0.22),
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

      if (synapticThread && nodePoints && eraseBurstMesh) {
        stageAnchor.add(synapticThread, nodePoints, eraseBurstMesh);
      }
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

    if (!pointerDrag) {
      currentRotationAngle += (isReducedMotion ? 0.0008 : 0.0025);
    }
    stageAnchor.rotation.y = currentRotationAngle;

    floatName(titleMesh, mainCamera, nowSec, Math.min(1, Math.max(0, (elapsedSec - STAGES.boot) / STAGES.deploy)));

    let hasPresenceMutations = false;
    activeEraseTransitions.forEach((trans, idx) => {
      const p = Math.min(1, (nowSec - trans.started) / ERASE_TRANSITION_SEC);
      const easedP = easeCubic(p);
      presenceArray[idx] = trans.from + (trans.to - trans.from) * easedP;
      hasPresenceMutations = true;
      if (p >= 1) activeEraseTransitions.delete(idx);
    });

    if (hasPresenceMutations && nodePoints && synapticThread) {
      const presenceAttr = nodePoints.geometry.getAttribute("presence") as THREE.BufferAttribute;
      presenceAttr.copyArray(presenceArray);
      presenceAttr.needsUpdate = true;
      updateThreadPresence(synapticThread, presenceArray);
    }

    if (nodePoints) {
      const u = nodePoints.material.uniforms;
      u.uTime!.value = nowSec;
      u.uShown!.value = mappedTotal;
      u.uHover!.value = currentHoveredIndex;
      u.uSelected!.value = currentSelectedIndex;
      u.uPixel!.value = webglRenderer.getPixelRatio();
      u.uFade!.value = Math.min(1, Math.max(0, (elapsedSec - introEndSec) / 0.8));
    }

    if (synapticThread) {
      const u = synapticThread.material.uniforms;
      u.uShown!.value = mappedTotal;
      u.uTime!.value = nowSec;
      u.uFade!.value = Math.min(1, Math.max(0, (elapsedSec - introEndSec) / 0.8));
    }

    if (eraseBurstMesh) {
      eraseBurstMesh.material.uniforms.uTime!.value = nowSec;
      eraseBurstMesh.material.uniforms.uPixel!.value = webglRenderer.getPixelRatio();
    }

    if (ambientDust) {
      ambientDust.material.uniforms.uTime!.value = nowSec;
    }
    if (corticalSurface) {
      corticalSurface.material.uniforms.uTime!.value = nowSec;
    }

    computeFramingProjection(container.clientWidth, container.clientHeight);

    if (!contextDropped) {
      postPipeline.film.uniforms.uTime!.value = nowSec;
      postPipeline.composer.render();
    }
  };

  lastFrameEpoch = performance.now() / 1000;
  animationFrameId = requestAnimationFrame(renderLoop);

  return {
    select(key: string | null) {
      currentSelectedIndex = key ? keyToIndexMap.get(key) ?? -1 : -1;
    },
    erase(key: string) {
      const idx = keyToIndexMap.get(key);
      if (idx === undefined) return;
      activeEraseTransitions.set(idx, {
        from: presenceArray[idx]!,
        to: 0,
        started: performance.now() / 1000,
      });
      if (eraseBurstMesh && coordinateNodes[idx]) {
        fireBurst(
          eraseBurstMesh,
          coordinateNodes[idx]!,
          performance.now() / 1000,
          PALETTE[opts.memories[idx]!.kind],
        );
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
      return idx !== undefined ? projectVertex(idx) : null;
    },
    skipIntro() {
      timelineSkipSec = sequenceEndSec + 10;
    },
    setFocus(margins: FocusMargins) {
      viewportMargins = { ...margins };
    },
    addLayer(layer: SceneLayer) {
      registeredLayers.add(layer);
      return () => {
        registeredLayers.delete(layer);
      };
    },
    setFilm(on: boolean) {
      postPipeline.setFilm(on);
    },
    dispose() {
      isTornDown = true;
      cancelAnimationFrame(animationFrameId);
      containerObserver.disconnect();
      domCanvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      webglRenderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      webglRenderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      postPipeline.dispose();
      webglRenderer.dispose();
      domCanvas.remove();
    },
  };
}

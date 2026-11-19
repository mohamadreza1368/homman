import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { BrandLogo } from "@/components/BrandLogo";
import { meshUrl } from "@/lib/manifest";
import { useSceneStore } from "@/stores/sceneStore";

import { brainOrganIds, ENOUGH_TO_DRAW } from "./brainSet";

/** Interval between animation frame requests (~30 frames per second). */
const TICK_INTERVAL_MS = 33;

/** Sliding sample window size for benchmarking device performance. */
const BENCHMARK_SAMPLE_LIMIT = 45;

/** Threshold average frametime causing wireframe secondary pass to be omitted. */
const DEGRADED_PERFORMANCE_LIMIT_MS = 45;

/**
 * Visual aesthetics and wave propagation parameters for the ambient resting canvas.
 */
export const LOOK = {
  opacity: 0.055,
  rimSharpness: 5.2,
  wireOpacity: 0.009,
  waves: 3,
  waveLife: 4.6,
  waveRest: 2.4,
  waveSpeed: 0.46,
  waveWidth: 0.13,
  waveStrength: 1.35,
  sparkStrength: 0.4,
  wordEvery: 34,
  wordVisible: 5.5,
  wordStrength: 0.38,
} as const;

/**
 * Calculates deterministic progression metrics for expanding neural wave pulses.
 */
export function waveState(
  waveIndex: number,
  elapsedSec: number,
  lifeSpan = LOOK.waveLife,
  restInterval = LOOK.waveRest,
  totalWaves = LOOK.waves,
): { age: number; emission: number; active: boolean } {
  const fullCycleTime = lifeSpan + restInterval;
  const phaseShiftedSec = elapsedSec - (waveIndex * fullCycleTime) / totalWaves;

  if (phaseShiftedSec < 0) {
    return { age: 0, emission: 0, active: false };
  }

  const emissionCount = Math.floor(phaseShiftedSec / fullCycleTime);
  const currentAge = phaseShiftedSec - emissionCount * fullCycleTime;

  return {
    age: currentAge,
    emission: emissionCount,
    active: currentAge <= lifeSpan,
  };
}

const BRAIN_NERVOUS_SOURCE_MESH = "nervous_male.glb";
const DRACO_ASSET_DIRECTORY = "/draco/";

const NEURAL_SHELL_VERTEX_GLSL = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    vec4 worldCoords = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - worldCoords.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldCoords;
  }
`;

const NEURAL_SHELL_FRAGMENT_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec3 uBody;
  uniform vec3 uPulse;
  uniform float uOpacity;
  uniform float uRimSharpness;
  uniform float uRadius;

  uniform vec3 uWaveSeed[WAVE_COUNT];
  uniform float uWaveAge[WAVE_COUNT];
  uniform float uWaveSpeed;
  uniform float uWaveWidth;
  uniform float uWaveStrength;
  uniform float uSparkStrength;
  uniform float uWaveLife;

  uniform sampler2D uWord;
  uniform float uWordStrength;
  uniform float uWordAngle;

  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec3 vLocal;

  float evaluateNeuralWave(vec3 pos, vec3 origin, float age) {
    if (age < 0.0) return 0.0;

    float distFromOrigin = length(pos - origin);
    float frontRadius = age * uWaveSpeed * uRadius;
    float bandSpan = uWaveWidth * uRadius;

    float expansionRing = 1.0 - smoothstep(0.0, bandSpan, abs(distFromOrigin - frontRadius));
    float focalSpark = (1.0 - smoothstep(0.0, bandSpan * 1.6, distFromOrigin))
                     * (1.0 - smoothstep(0.0, uWaveLife * 0.22, age));
    float dissipation = 1.0 - smoothstep(0.0, uWaveLife, age);

    return (expansionRing * dissipation + focalSpark * uSparkStrength) * uWaveStrength;
  }

  void main() {
    float angleFacing = abs(dot(normalize(vNormalW), normalize(vViewW)));
    float fresnelRim = pow(1.0 - angleFacing, uRimSharpness);

    float totalNeuralFlash = 0.0;
    for (int idx = 0; idx < WAVE_COUNT; idx++) {
      totalNeuralFlash += evaluateNeuralWave(vLocal, uWaveSeed[idx], uWaveAge[idx]);
    }

    float wordmarkIllumination = 0.0;
    if (uWordStrength > 0.001) {
      float cosAng = cos(uWordAngle);
      float sinAng = sin(uWordAngle);
      vec2 planarCoord = vec2(vLocal.x * cosAng - vLocal.z * sinAng, vLocal.y);
      vec2 textUv = planarCoord / (uRadius * 2.0) + 0.5;

      if (textUv.x > 0.0 && textUv.x < 1.0 && textUv.y > 0.0 && textUv.y < 1.0) {
        wordmarkIllumination = texture2D(uWord, textUv).r * uWordStrength;
      }
    }

    float combinedHighlights = totalNeuralFlash + wordmarkIllumination;
    float finalGlowIntensity = fresnelRim + combinedHighlights;

    vec3 blendedColor = mix(uBody, uPulse, clamp(combinedHighlights * 2.2, 0.0, 1.0));
    gl_FragColor = vec4(blendedColor * finalGlowIntensity, uOpacity * finalGlowIntensity);
  }
`;

function createWordmarkLightTexture(): THREE.CanvasTexture {
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = 512;
  offscreenCanvas.height = 512;
  const ctx = offscreenCanvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "13px";
    ctx.font = "600 58px ui-sans-serif, system-ui, -apple-system, sans-serif";
    ctx.fillText("HOOMAAN", offscreenCanvas.width / 2, offscreenCanvas.height / 2);
  }

  const generatedTexture = new THREE.CanvasTexture(offscreenCanvas);
  generatedTexture.colorSpace = THREE.NoColorSpace;
  return generatedTexture;
}

/**
 * Computes luminance and projection rotation angle for periodic wordmark emergence.
 */
export function wordmarkAt(elapsedSeconds: number): { strength: number; angle: number } {
  const cycleIndex = Math.floor(elapsedSeconds / LOOK.wordEvery);
  const cycleOffset = elapsedSeconds - cycleIndex * LOOK.wordEvery;

  if (cycleOffset > LOOK.wordVisible) {
    return { strength: 0, angle: 0 };
  }

  const normalizedProgress = cycleOffset / LOOK.wordVisible;
  const cosineFactor = 0.5 - Math.cos(normalizedProgress * Math.PI * 2) * 0.5;
  const outputStrength = cosineFactor * LOOK.wordStrength;

  const pseudoNoise = Math.sin(cycleIndex * 12.9898) * 43758.5453;
  const derivedAngle = (pseudoNoise - Math.floor(pseudoNoise)) * Math.PI * 2;

  return { strength: outputStrength, angle: derivedAngle };
}

function useDynamicFramePacing(): boolean {
  const triggerRedraw = useThree((state) => state.invalidate);
  const [renderSecondaryPass, setRenderSecondaryPass] = useState(true);
  const recordedDeltas = useRef<number[]>([]);
  const hasSettledTier = useRef(false);

  useEffect(() => {
    const pacingTimer = setInterval(() => triggerRedraw(), TICK_INTERVAL_MS);
    return () => clearInterval(pacingTimer);
  }, [triggerRedraw]);

  useFrame((_, deltaSec) => {
    if (hasSettledTier.current) return;
    recordedDeltas.current.push(deltaSec * 1000);
    if (recordedDeltas.current.length < BENCHMARK_SAMPLE_LIMIT) return;

    hasSettledTier.current = true;
    const averageDelta =
      recordedDeltas.current.reduce((acc, ms) => acc + ms, 0) / recordedDeltas.current.length;

    if (averageDelta > DEGRADED_PERFORMANCE_LIMIT_MS) {
      setRenderSecondaryPass(false);
    }
  });

  return renderSecondaryPass;
}

function BrainModelCluster({ organIds, freezeMotion }: { organIds: string[]; freezeMotion: boolean }) {
  const { nodes: gltfNodes } = useGLTF(meshUrl(BRAIN_NERVOUS_SOURCE_MESH), DRACO_ASSET_DIRECTORY);
  const sceneOrgansMap = useSceneStore((state) => state.organs);
  const containerGroupRef = useRef<THREE.Group>(null);
  const enableLattice = useDynamicFramePacing();

  const unifiedBrainGeometry = useMemo(() => {
    const collectedGeometries: THREE.BufferGeometry[] = [];

    for (const organKey of organIds) {
      const organMetadata = sceneOrgansMap[organKey];
      if (!organMetadata) continue;

      const targetNode =
        gltfNodes[organMetadata.node] ??
        gltfNodes[THREE.PropertyBinding.sanitizeNodeName(organMetadata.node)];

      if (!(targetNode instanceof THREE.Mesh)) continue;

      targetNode.updateWorldMatrix(true, false);
      const bakedPart = targetNode.geometry.clone().applyMatrix4(targetNode.matrixWorld);

      for (const attrKey of Object.keys(bakedPart.attributes)) {
        if (attrKey !== "position" && attrKey !== "normal") {
          bakedPart.deleteAttribute(attrKey);
        }
      }
      collectedGeometries.push(bakedPart);
    }

    if (collectedGeometries.length === 0) return null;

    const merged = mergeGeometries(collectedGeometries, false);
    for (const piece of collectedGeometries) piece.dispose();
    if (!merged) return null;

    merged.computeBoundingSphere();
    const meshCenter = merged.boundingSphere?.center ?? new THREE.Vector3();
    merged.translate(-meshCenter.x, -meshCenter.y, -meshCenter.z);
    merged.computeBoundingSphere();
    return merged;
  }, [gltfNodes, organIds, sceneOrgansMap]);

  const uniformTime = useMemo(() => ({ value: 0 }), []);
  const uniformWordStrength = useMemo(() => ({ value: 0 }), []);
  const uniformWordAngle = useMemo(() => ({ value: 0 }), []);
  const wordmarkCanvasTexture = useMemo(() => createWordmarkLightTexture(), []);

  const waveSeedPositions = useMemo(
    () => ({
      value: Array.from({ length: LOOK.waves }, () => new THREE.Vector3()),
    }),
    [],
  );
  const waveAgesUniform = useMemo(
    () => ({ value: Array.from({ length: LOOK.waves }, () => -1) }),
    [],
  );
  const trackedWaveCycles = useRef<number[]>(Array.from({ length: LOOK.waves }, () => -1));

  const neuralShaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NEURAL_SHELL_VERTEX_GLSL,
        fragmentShader: NEURAL_SHELL_FRAGMENT_GLSL.replaceAll("WAVE_COUNT", String(LOOK.waves)),
        uniforms: {
          uTime: uniformTime,
          uBody: { value: new THREE.Color("#9aa3b0") },
          uPulse: { value: new THREE.Color("#38bdf8") },
          uOpacity: { value: LOOK.opacity },
          uRimSharpness: { value: LOOK.rimSharpness },
          uWaveSeed: waveSeedPositions,
          uWaveAge: waveAgesUniform,
          uWaveSpeed: { value: LOOK.waveSpeed },
          uWaveWidth: { value: LOOK.waveWidth },
          uWaveStrength: { value: LOOK.waveStrength },
          uSparkStrength: { value: LOOK.sparkStrength },
          uWaveLife: { value: LOOK.waveLife },
          uWord: { value: wordmarkCanvasTexture },
          uWordStrength: uniformWordStrength,
          uWordAngle: uniformWordAngle,
          uRadius: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
      }),
    [
      uniformTime,
      wordmarkCanvasTexture,
      uniformWordStrength,
      uniformWordAngle,
      waveSeedPositions,
      waveAgesUniform,
    ],
  );

  const wireframeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#7dd3fc",
        wireframe: true,
        transparent: true,
        opacity: LOOK.wireOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => {
    const calculatedRadius = unifiedBrainGeometry?.boundingSphere?.radius;
    if (calculatedRadius) {
      neuralShaderMaterial.uniforms.uRadius!.value = calculatedRadius;
    }
  }, [unifiedBrainGeometry, neuralShaderMaterial]);

  useEffect(() => {
    return () => {
      unifiedBrainGeometry?.dispose();
      neuralShaderMaterial.dispose();
      wireframeMaterial.dispose();
      wordmarkCanvasTexture.dispose();
    };
  }, [unifiedBrainGeometry, neuralShaderMaterial, wireframeMaterial, wordmarkCanvasTexture]);

  useFrame((state) => {
    if (freezeMotion) return;
    const currentSeconds = state.clock.elapsedTime;
    uniformTime.value = currentSeconds;

    const vertexPositions = unifiedBrainGeometry?.getAttribute("position");
    for (let waveIdx = 0; waveIdx < LOOK.waves; waveIdx += 1) {
      const stateSnapshot = waveState(waveIdx, currentSeconds);
      waveAgesUniform.value[waveIdx] = stateSnapshot.active ? stateSnapshot.age : -1;

      if (stateSnapshot.emission !== trackedWaveCycles.current[waveIdx] && vertexPositions) {
        trackedWaveCycles.current[waveIdx] = stateSnapshot.emission;
        const randomVertexIndex = Math.floor(Math.random() * vertexPositions.count);
        waveSeedPositions.value[waveIdx]!.fromBufferAttribute(vertexPositions, randomVertexIndex);
      }
    }

    const currentMark = wordmarkAt(currentSeconds);
    uniformWordStrength.value = currentMark.strength;
    uniformWordAngle.value = currentMark.angle;

    if (containerGroupRef.current) {
      containerGroupRef.current.rotation.y = currentSeconds * 0.13;
    }
  });

  if (!unifiedBrainGeometry) return null;
  const normalizationRadius = unifiedBrainGeometry.boundingSphere?.radius ?? 1;

  return (
    <group ref={containerGroupRef} scale={1 / normalizationRadius}>
      <mesh geometry={unifiedBrainGeometry} material={neuralShaderMaterial} />
      {enableLattice && <mesh geometry={unifiedBrainGeometry} material={wireframeMaterial} />}
    </group>
  );
}

/**
 * Fullscreen ambient resting screen showcasing translucent 3D brain geometry with neural wave animations.
 */
export function IdleScreen({ onDismiss }: { onDismiss: () => void }) {
  const loadedOrgans = useSceneStore((state) => state.organs);
  const hiddenSystemsList = useSceneStore((state) => state.hiddenSystems);

  const matchedBrainIds = useMemo(() => brainOrganIds(Object.values(loadedOrgans)), [loadedOrgans]);
  const isNervousLoaded = !hiddenSystemsList.includes("nervous");

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
    [],
  );

  if (!isNervousLoaded || matchedBrainIds.length < ENOUGH_TO_DRAW) return null;

  return (
    <div
      className="fixed inset-0 z-50 cursor-none bg-slate-950"
      onPointerDown={onDismiss}
      role="presentation"
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 3.1], fov: 42 }}
      >
        <BrainModelCluster organIds={matchedBrainIds} freezeMotion={prefersReducedMotion} />
      </Canvas>
      <BrandLogo
        variant="mono-white"
        className="pointer-events-none absolute bottom-6 left-8 h-9 w-auto opacity-35"
        decorative
      />
    </div>
  );
}

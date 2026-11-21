/**
 * HOOMAAN Ambient Idle & Power Conservation Screen
 * Renders an energy-efficient low-power 3D holographic neural silhouette
 * with ambient synaptic wave propagation and brand projection.
 * Implemented from specs/idle-power-conservation.md.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { BrandLogo } from "@/components/BrandLogo";
import { meshUrl } from "@/lib/manifest";
import { useSceneStore } from "@/stores/sceneStore";
import { brainOrganIds, ENOUGH_TO_DRAW } from "./brainSet";

const TARGET_IDLE_FPS = 30;
const PACING_TICK_DELTA = Math.round(1000 / TARGET_IDLE_FPS);
const BENCHMARK_SAMPLES = 40;
const SLOW_RENDER_THRESHOLD_MS = 45;

export const LOOK = Object.freeze({
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
} as const);

export function waveState(
  index: number,
  timeSec: number,
  lifetime = LOOK.waveLife,
  restInterval = LOOK.waveRest,
  totalPulses = LOOK.waves,
): { age: number; emission: number; active: boolean } {
  const period = lifetime + restInterval;
  const timeWithPhase = timeSec - (index * period) / totalPulses;

  if (timeWithPhase < 0) {
    return { age: 0, emission: 0, active: false };
  }

  const cycleNum = Math.floor(timeWithPhase / period);
  const cycleTime = timeWithPhase - cycleNum * period;

  return {
    age: cycleTime,
    emission: cycleNum,
    active: cycleTime <= lifetime,
  };
}

export function wordmarkAt(currentSec: number): { strength: number; angle: number } {
  const cycleIndex = Math.floor(currentSec / LOOK.wordEvery);
  const remainder = currentSec - cycleIndex * LOOK.wordEvery;

  if (remainder > LOOK.wordVisible) {
    return { strength: 0, angle: 0 };
  }

  const progressNorm = remainder / LOOK.wordVisible;
  const bellEnvelope = (1 - Math.cos(progressNorm * Math.PI * 2)) * 0.5;
  const activeLuminance = bellEnvelope * LOOK.wordStrength;

  const pseudoRandomSeed = Math.sin(cycleIndex * 12.9898) * 43758.5453;
  const projectionTheta = (pseudoRandomSeed - Math.floor(pseudoRandomSeed)) * Math.PI * 2;

  return { strength: activeLuminance, angle: projectionTheta };
}

const SHADER_VERTEX_SOURCE = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldView;
  varying vec3 vModelPos;

  void main() {
    vModelPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldView = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SHADER_FRAGMENT_SOURCE = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorBase;
  uniform vec3 uColorAccent;
  uniform float uBaseAlpha;
  uniform float uRimPower;
  uniform float uModelRadius;

  uniform vec3 uPulseOrigins[NUM_WAVES];
  uniform float uPulseAges[NUM_WAVES];
  uniform float uSpeed;
  uniform float uThickness;
  uniform float uGain;
  uniform float uSparkGain;
  uniform float uDuration;

  uniform sampler2D uWatermarkTex;
  uniform float uWatermarkAlpha;
  uniform float uWatermarkAngle;

  varying vec3 vWorldNormal;
  varying vec3 vWorldView;
  varying vec3 vModelPos;

  float calculateWaveLuminance(vec3 point, vec3 origin, float age) {
    if (age < 0.0) return 0.0;
    float dist = length(point - origin);
    float expandRadius = age * uSpeed * uModelRadius;
    float ringSpread = uThickness * uModelRadius;

    float waveBand = 1.0 - smoothstep(0.0, ringSpread, abs(dist - expandRadius));
    float centerOriginFlash = (1.0 - smoothstep(0.0, ringSpread * 1.6, dist)) * (1.0 - smoothstep(0.0, uDuration * 0.22, age));
    float timeDecay = 1.0 - smoothstep(0.0, uDuration, age);

    return (waveBand * timeDecay + centerOriginFlash * uSparkGain) * uGain;
  }

  void main() {
    float glance = abs(dot(normalize(vWorldNormal), normalize(vWorldView)));
    float edgeFresnel = pow(1.0 - glance, uRimPower);

    float combinedFlash = 0.0;
    for (int i = 0; i < NUM_WAVES; i++) {
      combinedFlash += calculateWaveLuminance(vModelPos, uPulseOrigins[i], uPulseAges[i]);
    }

    float markIntensity = 0.0;
    if (uWatermarkAlpha > 0.001) {
      float c = cos(uWatermarkAngle);
      float s = sin(uWatermarkAngle);
      vec2 rotatedPlanar = vec2(vModelPos.x * c - vModelPos.z * s, vModelPos.y);
      vec2 texCoord = rotatedPlanar / (uModelRadius * 2.0) + 0.5;

      if (texCoord.x > 0.0 && texCoord.x < 1.0 && texCoord.y > 0.0 && texCoord.y < 1.0) {
        markIntensity = texture2D(uWatermarkTex, texCoord).r * uWatermarkAlpha;
      }
    }

    float highlights = combinedFlash + markIntensity;
    float finalIntensity = edgeFresnel + highlights;
    vec3 outColor = mix(uColorBase, uColorAccent, clamp(highlights * 2.2, 0.0, 1.0));

    gl_FragColor = vec4(outColor * finalIntensity, uBaseAlpha * finalIntensity);
  }
`;

function generateWordmarkTexture(): THREE.CanvasTexture {
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 512;
  const ctx = surface.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "13px";
    ctx.font = "600 58px ui-sans-serif, system-ui, -apple-system, sans-serif";
    ctx.fillText("HOOMAAN", 256, 256);
  }

  const tex = new THREE.CanvasTexture(surface);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function useAdaptivePerformance(): boolean {
  const invalidate = useThree((s) => s.invalidate);
  const [wireframeActive, setWireframeActive] = useState(true);
  const frameIntervals = useRef<number[]>([]);
  const benchmarkingComplete = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => invalidate(), PACING_TICK_DELTA);
    return () => clearInterval(timer);
  }, [invalidate]);

  useFrame((_, delta) => {
    if (benchmarkingComplete.current) return;
    frameIntervals.current.push(delta * 1000);

    if (frameIntervals.current.length >= BENCHMARK_SAMPLES) {
      benchmarkingComplete.current = true;
      const averageInterval =
        frameIntervals.current.reduce((a, b) => a + b, 0) / frameIntervals.current.length;
      if (averageInterval > SLOW_RENDER_THRESHOLD_MS) {
        setWireframeActive(false);
      }
    }
  });

  return wireframeActive;
}

interface NeuralMeshProps {
  organList: string[];
  reducedMotion: boolean;
}

function HolographicBrainStructure({ organList, reducedMotion }: NeuralMeshProps) {
  const { nodes: assetNodes } = useGLTF(meshUrl("nervous_male.glb"), "/draco/");
  const allOrgans = useSceneStore((s) => s.organs);
  const rootPivot = useRef<THREE.Group>(null);
  const showWireLattice = useAdaptivePerformance();

  const combinedBrainBuffer = useMemo(() => {
    const geometryParts: THREE.BufferGeometry[] = [];

    for (const organKey of organList) {
      const organMeta = allOrgans[organKey];
      if (!organMeta) continue;

      const glNode =
        assetNodes[organMeta.node] ??
        assetNodes[THREE.PropertyBinding.sanitizeNodeName(organMeta.node)];

      if (!(glNode instanceof THREE.Mesh)) continue;

      glNode.updateWorldMatrix(true, false);
      const clonedGeom = glNode.geometry.clone().applyMatrix4(glNode.matrixWorld);

      for (const attr of Object.keys(clonedGeom.attributes)) {
        if (attr !== "position" && attr !== "normal") {
          clonedGeom.deleteAttribute(attr);
        }
      }
      geometryParts.push(clonedGeom);
    }

    if (geometryParts.length === 0) return null;

    const mergedMesh = mergeGeometries(geometryParts, false);
    for (const p of geometryParts) p.dispose();
    if (!mergedMesh) return null;

    mergedMesh.computeBoundingSphere();
    const centerPoint = mergedMesh.boundingSphere?.center ?? new THREE.Vector3();
    mergedMesh.translate(-centerPoint.x, -centerPoint.y, -centerPoint.z);
    mergedMesh.computeBoundingSphere();
    return mergedMesh;
  }, [assetNodes, organList, allOrgans]);

  const clockUniform = useMemo(() => ({ value: 0 }), []);
  const watermarkLumaUniform = useMemo(() => ({ value: 0 }), []);
  const watermarkAngleUniform = useMemo(() => ({ value: 0 }), []);
  const wordmarkTexture = useMemo(() => generateWordmarkTexture(), []);

  const originPositions = useMemo(
    () => ({
      value: Array.from({ length: LOOK.waves }, () => new THREE.Vector3()),
    }),
    [],
  );

  const waveProgressions = useMemo(
    () => ({
      value: Array.from({ length: LOOK.waves }, () => -1),
    }),
    [],
  );

  const completedCycles = useRef<number[]>(Array.from({ length: LOOK.waves }, () => -1));

  const holographicMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHADER_VERTEX_SOURCE,
        fragmentShader: SHADER_FRAGMENT_SOURCE.replaceAll("NUM_WAVES", String(LOOK.waves)),
        uniforms: {
          uTime: clockUniform,
          uColorBase: { value: new THREE.Color("#9aa3b0") },
          uColorAccent: { value: new THREE.Color("#38bdf8") },
          uBaseAlpha: { value: LOOK.opacity },
          uRimPower: { value: LOOK.rimSharpness },
          uPulseOrigins: originPositions,
          uPulseAges: waveProgressions,
          uSpeed: { value: LOOK.waveSpeed },
          uThickness: { value: LOOK.waveWidth },
          uGain: { value: LOOK.waveStrength },
          uSparkGain: { value: LOOK.sparkStrength },
          uDuration: { value: LOOK.waveLife },
          uWatermarkTex: { value: wordmarkTexture },
          uWatermarkAlpha: watermarkLumaUniform,
          uWatermarkAngle: watermarkAngleUniform,
          uModelRadius: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
      }),
    [clockUniform, originPositions, waveProgressions, wordmarkTexture, watermarkLumaUniform, watermarkAngleUniform],
  );

  const latticeMaterial = useMemo(
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
    const rad = combinedBrainBuffer?.boundingSphere?.radius;
    if (rad && holographicMaterial.uniforms.uModelRadius) {
      holographicMaterial.uniforms.uModelRadius.value = rad;
    }
  }, [combinedBrainBuffer, holographicMaterial]);

  useEffect(() => {
    return () => {
      combinedBrainBuffer?.dispose();
      holographicMaterial.dispose();
      latticeMaterial.dispose();
      wordmarkTexture.dispose();
    };
  }, [combinedBrainBuffer, holographicMaterial, latticeMaterial, wordmarkTexture]);

  useFrame((state) => {
    if (reducedMotion) return;

    const t = state.clock.elapsedTime;
    clockUniform.value = t;

    const positions = combinedBrainBuffer?.getAttribute("position");
    for (let i = 0; i < LOOK.waves; i++) {
      const snap = waveState(i, t);
      waveProgressions.value[i] = snap.active ? snap.age : -1;

      if (snap.emission !== completedCycles.current[i] && positions) {
        completedCycles.current[i] = snap.emission;
        const randIndex = Math.floor(Math.random() * positions.count);
        originPositions.value[i]!.fromBufferAttribute(positions, randIndex);
      }
    }

    const mark = wordmarkAt(t);
    watermarkLumaUniform.value = mark.strength;
    watermarkAngleUniform.value = mark.angle;

    if (rootPivot.current) {
      rootPivot.current.rotation.y = t * 0.13;
    }
  });

  if (!combinedBrainBuffer) return null;
  const invScale = 1 / (combinedBrainBuffer.boundingSphere?.radius ?? 1);

  return (
    <group ref={rootPivot} scale={invScale}>
      <mesh geometry={combinedBrainBuffer} material={holographicMaterial} />
      {showWireLattice && <mesh geometry={combinedBrainBuffer} material={latticeMaterial} />}
    </group>
  );
}

export function IdleScreen({ onDismiss }: { onDismiss: () => void }) {
  const organsMap = useSceneStore((s) => s.organs);
  const hiddenSystems = useSceneStore((s) => s.hiddenSystems);

  const brainIds = useMemo(() => brainOrganIds(Object.values(organsMap)), [organsMap]);
  const isNervousActive = !hiddenSystems.includes("nervous");

  const prefersReduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
    [],
  );

  const handlePointerDown = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  if (!isNervousActive || brainIds.length < ENOUGH_TO_DRAW) return null;

  return (
    <div
      className="fixed inset-0 z-50 cursor-none bg-slate-950"
      onPointerDown={handlePointerDown}
      role="presentation"
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 3.1], fov: 42 }}
      >
        <HolographicBrainStructure organList={brainIds} reducedMotion={prefersReduced} />
      </Canvas>
      <BrandLogo
        variant="mono-white"
        className="pointer-events-none absolute bottom-6 left-8 h-9 w-auto opacity-35"
        decorative
      />
    </div>
  );
}

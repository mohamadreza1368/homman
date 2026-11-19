/**
 * Hoomaan 3D Viewer - Vascular Blood Flow Pulse & Hemodynamic Simulation
 */

import * as THREE from "three";
import type { ManifestOrgan } from "@/lib/schemas";
import { BREATH_ROLE, injectBreath } from "./breathing";
import { beatChamber, BLOOD_HEX, type Chamber } from "./heartbeat";

export type FlowKind = "artery" | "vein" | "pulmonary_artery" | "pulmonary_vein";

const VESSEL_PATH_MAP: ReadonlyArray<[string, FlowKind]> = [
  ["Pulmonary arteries", "pulmonary_artery"],
  ["Pulmonary veins", "pulmonary_vein"],
  ["Systemic arteries", "artery"],
  ["Arteries of heart", "artery"],
  ["Systemic veins", "vein"],
  ["Cardiac veins", "vein"],
];

/** Resolves hemodynamic flow classification for vascular anatomical manifest entries. */
export function vesselFlow(
  organ: Pick<ManifestOrgan, "system" | "path" | "ta2_latin">,
): FlowKind | null {
  if (organ.system !== "cardiovascular") return null;
  if (beatChamber(organ) !== null) return null;

  const organPath = organ.path;
  if (!organPath || organPath.length === 0) return null;

  for (const [tag, kind] of VESSEL_PATH_MAP) {
    if (organPath.includes(tag)) {
      return kind;
    }
  }

  return null;
}

export const FLOW_CHAMBER: Readonly<Record<FlowKind, Chamber>> = Object.freeze({
  artery: "left_ventricle",
  pulmonary_artery: "right_ventricle",
  vein: "right_atrium",
  pulmonary_vein: "left_atrium",
});

export const PULSE_SLOTS = 8;
export const EJECTION_DELAY_S = 0.06;

export const FLOW_SHAPE = Object.freeze({
  arterySpeed: 0.8,
  pulmonarySpeed: 0.3,
  width: 0.07,
  reach: 1.2,
  venousWave: 0.14,
  venousSpeed: 0.12,
});

const CONSTANTS = Object.freeze({
  lifetime: 3.0,
  window: 3.0,
  normalPulsesInWindow: (72 / 60) * 3.0,
  venousSettleRate: 1.5,
});

interface EjectionWave {
  launch: number;
  strength: number;
}

/** Manages active ejection pulses and calculates dynamic venous blood return level. */
export class PulseTrain {
  private activePulses: EjectionWave[] = [];
  venous = 0;

  launch(timestamp: number, forceMagnitude: number): void {
    if (forceMagnitude <= 0) return;
    const wave: EjectionWave = {
      launch: timestamp + EJECTION_DELAY_S,
      strength: Math.min(1, forceMagnitude),
    };
    this.activePulses.push(wave);
    if (this.activePulses.length > PULSE_SLOTS) {
      this.activePulses.splice(0, this.activePulses.length - PULSE_SLOTS);
    }
  }

  advance(currentTime: number, deltaSec: number, agesOut: Float32Array, strengthsOut: Float32Array): void {
    this.activePulses = this.activePulses.filter((wave) => currentTime - wave.launch < CONSTANTS.lifetime);

    let recentSum = 0;
    for (const w of this.activePulses) {
      if (w.launch <= currentTime && currentTime - w.launch < CONSTANTS.window) {
        recentSum += w.strength;
      }
    }

    const targetFraction = Math.min(1, recentSum / CONSTANTS.normalPulsesInWindow);
    const lerpFactor = Math.min(1, deltaSec / CONSTANTS.venousSettleRate);
    this.venous += (targetFraction - this.venous) * lerpFactor;

    for (let slot = 0; slot < PULSE_SLOTS; slot++) {
      const w = this.activePulses[slot];
      if (w) {
        agesOut[slot] = currentTime - w.launch;
        strengthsOut[slot] = w.strength;
      } else {
        agesOut[slot] = -1;
        strengthsOut[slot] = 0;
      }
    }
  }

  reset(): void {
    this.activePulses = [];
    this.venous = 0;
  }
}

export const FLOW_UNIFORMS = {
  uPulseAge: { value: new Float32Array(PULSE_SLOTS).fill(-1) },
  uPulseStrength: { value: new Float32Array(PULSE_SLOTS) },
  uVenous: { value: 0 },
  uFlowTime: { value: 0 },
  uFlowSteady: { value: 0 },
};

export const FLOW_SOURCES: Readonly<Record<FlowKind, { value: THREE.Vector3 }>> = Object.freeze({
  artery: { value: new THREE.Vector3() },
  vein: { value: new THREE.Vector3() },
  pulmonary_artery: { value: new THREE.Vector3() },
  pulmonary_vein: { value: new THREE.Vector3() },
});

const FLOW_COLOUR: Readonly<Record<FlowKind, string>> = Object.freeze({
  artery: BLOOD_HEX.left,
  pulmonary_vein: BLOOD_HEX.left,
  vein: BLOOD_HEX.right,
  pulmonary_artery: BLOOD_HEX.right,
});

const FLOW_GAIN: Readonly<Record<FlowKind, number>> = Object.freeze({
  artery: 0.4,
  pulmonary_artery: 0.22,
  vein: 0.5,
  pulmonary_vein: 0.35,
});

const FLOW_MODE: Readonly<Record<FlowKind, number>> = Object.freeze({
  artery: 0,
  pulmonary_artery: 0,
  vein: 1,
  pulmonary_vein: 1,
});

type Shader = Parameters<THREE.Material["onBeforeCompile"]>[0];
export const FLOW_PATH_ATTRIBUTE = "flowPath";

const SEED_PATTERNS: Readonly<Record<FlowKind, RegExp>> = Object.freeze({
  artery: /^Aorta ascendens\b/i,
  pulmonary_artery: /^Truncus pulmonalis\b/i,
  vein: /^Vena cava (superior|inferior)\b/i,
  pulmonary_vein: /^Vena pulmonalis\b/i,
});

export function isFlowSeed(kind: FlowKind, organ: Pick<ManifestOrgan, "ta2_latin">): boolean {
  return SEED_PATTERNS[kind].test(organ.ta2_latin);
}

export interface FlowingMesh {
  mesh: THREE.Mesh;
  kind: FlowKind;
  seed: boolean;
}

export const FLOWING = new Map<string, FlowingMesh>();
export const FLOWING_VERSION = { value: 0 };

export function registerFlowing(organId: string, entry: FlowingMesh): () => void {
  FLOWING.set(organId, entry);
  FLOWING_VERSION.value += 1;
  return () => {
    if (FLOWING.get(organId) === entry) {
      FLOWING.delete(organId);
      FLOWING_VERSION.value += 1;
    }
  };
}

export const FLOW_PROBE = { pathMs: -1, vertices: 0 };

export const FLOW_VERTEX = `
attribute float ${FLOW_PATH_ATTRIBUTE};
varying vec3 vFlowWorld;
varying float vFlowPath;
`;

export const FLOW_FRAGMENT = `
uniform float uPulseAge[${PULSE_SLOTS}];
uniform float uPulseStrength[${PULSE_SLOTS}];
uniform float uVenous;
uniform float uFlowTime;
uniform float uFlowSteady;
uniform vec3 uFlowSource;
uniform float uFlowMode;
uniform float uFlowSpeed;
uniform float uFlowGain;
varying vec3 vFlowWorld;
varying float vFlowPath;

float flowGlow() {
  float d = vFlowPath > 0.5 ? vFlowPath - 1.0 : distance(vFlowWorld, uFlowSource);
  if (uFlowMode < 0.5 && uFlowSteady < 0.5) {
    float glow = 0.0;
    for (int i = 0; i < ${PULSE_SLOTS}; i++) {
      if (uPulseAge[i] < 0.0 || uPulseStrength[i] <= 0.0) continue;
      float front = uPulseAge[i] * uFlowSpeed;
      float x = (d - front) / ${FLOW_SHAPE.width.toFixed(3)};
      glow += uPulseStrength[i] * exp(-x * x) * exp(-front / ${FLOW_SHAPE.reach.toFixed(3)});
    }
    return uFlowGain * clamp(glow, 0.0, 1.0);
  }
  float away = uFlowMode < 0.5 ? -1.0 : 1.0;
  float stripe = 0.5 + 0.5 * sin((d + away * uFlowTime * ${FLOW_SHAPE.venousSpeed.toFixed(3)}) * 6.2831853 / ${FLOW_SHAPE.venousWave.toFixed(3)});
  return uFlowGain * uVenous * (0.18 + 0.22 * stripe);
}
`;

function flowOnBeforeCompile(this: THREE.Material, shader: Shader): void {
  const hostUserData = this.userData as {
    flowSource: { value: THREE.Vector3 };
    flowMode: number;
    flowSpeed: number;
    flowGain: number;
  };

  Object.assign(shader.uniforms, FLOW_UNIFORMS, {
    uFlowSource: hostUserData.flowSource,
    uFlowMode: { value: hostUserData.flowMode },
    uFlowSpeed: { value: hostUserData.flowSpeed },
    uFlowGain: { value: hostUserData.flowGain },
  });

  const vertexHook = `#include <common>\n${FLOW_VERTEX}`;
  const vertexProjHook = `#include <project_vertex>\n  vFlowWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vFlowPath = ${FLOW_PATH_ATTRIBUTE};`;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", vertexHook)
    .replace("#include <project_vertex>", vertexProjHook);

  const fragmentHook = `#include <common>\n${FLOW_FRAGMENT}`;
  const fragmentDiffuseHook = "vec4 diffuseColor = vec4( diffuse, opacity * flowGlow() );";
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", fragmentHook)
    .replace("vec4 diffuseColor = vec4( diffuse, opacity );", fragmentDiffuseHook);

  injectBreath(shader, this);
}

const materialRegistry = new Map<FlowKind, THREE.MeshBasicMaterial>();

/** Produces or retrieves cached shared flow overlay material for specified vessel kind. */
export function flowMaterial(kind: FlowKind): THREE.MeshBasicMaterial {
  let existing = materialRegistry.get(kind);
  if (!existing) {
    existing = new THREE.MeshBasicMaterial({
      color: FLOW_COLOUR[kind],
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    existing.userData = {
      flowSource: FLOW_SOURCES[kind],
      flowMode: FLOW_MODE[kind],
      flowGain: FLOW_GAIN[kind],
      flowSpeed: kind === "pulmonary_artery" ? FLOW_SHAPE.pulmonarySpeed : FLOW_SHAPE.arterySpeed,
      breathRole: kind.startsWith("pulmonary") ? BREATH_ROLE.lung : BREATH_ROLE.vessel,
    };
    existing.onBeforeCompile = flowOnBeforeCompile;
    materialRegistry.set(kind, existing);
  }
  return existing;
}

/** Returns collection of all instantiated flow materials for viewport clipping updates. */
export function flowMaterials(): Iterable<THREE.MeshBasicMaterial> {
  return materialRegistry.values();
}

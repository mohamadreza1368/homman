/**
 * Hoomaan 3D Viewer - Vascular Blood Flow Pulse & Hemodynamic Simulation
 */

import * as THREE from "three";
import type { ManifestOrgan } from "@/lib/schemas";
import { BREATH_ROLE, injectBreath } from "./breathing";
import { beatChamber, BLOOD_HEX, type Chamber } from "./heartbeat";

export type FlowKind = "artery" | "vein" | "pulmonary_artery" | "pulmonary_vein";

/** Resolves hemodynamic flow classification for vascular anatomical manifest entries. */
export function vesselFlow(
  organ: Pick<ManifestOrgan, "system" | "path" | "ta2_latin">,
): FlowKind | null {
  if (organ.system !== "cardiovascular") return null;
  if (beatChamber(organ) !== null) return null;

  const path = organ.path ?? [];
  if (path.includes("Pulmonary arteries")) return "pulmonary_artery";
  if (path.includes("Pulmonary veins")) return "pulmonary_vein";
  if (path.includes("Systemic arteries") || path.includes("Arteries of heart")) return "artery";
  if (path.includes("Systemic veins") || path.includes("Cardiac veins")) return "vein";

  return null;
}

export const FLOW_CHAMBER: Readonly<Record<FlowKind, Chamber>> = {
  artery: "left_ventricle",
  pulmonary_artery: "right_ventricle",
  vein: "right_atrium",
  pulmonary_vein: "left_atrium",
};

export const PULSE_SLOTS = 8;
export const EJECTION_DELAY_S = 0.06;

export const FLOW_SHAPE = {
  arterySpeed: 0.8,
  pulmonarySpeed: 0.3,
  width: 0.07,
  reach: 1.2,
  venousWave: 0.14,
  venousSpeed: 0.12,
} as const;

const PULSE_LIFETIME_S = 3;
const OUTPUT_WINDOW_S = 3;
const NORMAL_PULSES_IN_WINDOW = (72 / 60) * OUTPUT_WINDOW_S;
const VENOUS_SETTLE_S = 1.5;

interface FlowPulse {
  launch: number;
  strength: number;
}

/** Manages active ejection pulses and calculates dynamic venous blood return level. */
export class PulseTrain {
  private pulses: FlowPulse[] = [];
  venous = 0;

  launch(at: number, strength: number): void {
    if (!(strength > 0)) return;
    this.pulses.push({ launch: at + EJECTION_DELAY_S, strength: Math.min(1, strength) });
    if (this.pulses.length > PULSE_SLOTS) {
      this.pulses.splice(0, this.pulses.length - PULSE_SLOTS);
    }
  }

  advance(now: number, step: number, ages: Float32Array, strengths: Float32Array): void {
    this.pulses = this.pulses.filter((p) => now - p.launch < PULSE_LIFETIME_S);

    const recentSum = this.pulses
      .filter((p) => p.launch <= now && now - p.launch < OUTPUT_WINDOW_S)
      .reduce((sum, p) => sum + p.strength, 0);

    const target = Math.min(1, recentSum / NORMAL_PULSES_IN_WINDOW);
    this.venous += (target - this.venous) * Math.min(1, step / VENOUS_SETTLE_S);

    for (let i = 0; i < PULSE_SLOTS; i++) {
      const p = this.pulses[i];
      ages[i] = p ? now - p.launch : -1;
      strengths[i] = p ? p.strength : 0;
    }
  }

  reset(): void {
    this.pulses = [];
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

export const FLOW_SOURCES: Readonly<Record<FlowKind, { value: THREE.Vector3 }>> = {
  artery: { value: new THREE.Vector3() },
  vein: { value: new THREE.Vector3() },
  pulmonary_artery: { value: new THREE.Vector3() },
  pulmonary_vein: { value: new THREE.Vector3() },
};

const FLOW_COLOUR: Readonly<Record<FlowKind, string>> = {
  artery: BLOOD_HEX.left,
  pulmonary_vein: BLOOD_HEX.left,
  vein: BLOOD_HEX.right,
  pulmonary_artery: BLOOD_HEX.right,
};

const FLOW_GAIN: Readonly<Record<FlowKind, number>> = {
  artery: 0.4,
  pulmonary_artery: 0.22,
  vein: 0.5,
  pulmonary_vein: 0.35,
};

const FLOW_MODE: Readonly<Record<FlowKind, number>> = {
  artery: 0,
  pulmonary_artery: 0,
  vein: 1,
  pulmonary_vein: 1,
};

type Shader = Parameters<THREE.Material["onBeforeCompile"]>[0];
export const FLOW_PATH_ATTRIBUTE = "flowPath";

const SEED: Readonly<Record<FlowKind, RegExp>> = {
  artery: /^Aorta ascendens\b/i,
  pulmonary_artery: /^Truncus pulmonalis\b/i,
  vein: /^Vena cava (superior|inferior)\b/i,
  pulmonary_vein: /^Vena pulmonalis\b/i,
};

export function isFlowSeed(kind: FlowKind, organ: Pick<ManifestOrgan, "ta2_latin">): boolean {
  return SEED[kind].test(organ.ta2_latin);
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
    if (FLOWING.get(organId) !== entry) return;
    FLOWING.delete(organId);
    FLOWING_VERSION.value += 1;
  };
}

export const FLOW_PROBE = { pathMs: -1, vertices: 0 };

export const FLOW_VERTEX = /* glsl */ `
attribute float ${FLOW_PATH_ATTRIBUTE};
varying vec3 vFlowWorld;
varying float vFlowPath;
`;

export const FLOW_FRAGMENT = /* glsl */ `
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
  const data = this.userData as {
    flowSource: { value: THREE.Vector3 };
    flowMode: number;
    flowSpeed: number;
    flowGain: number;
  };
  Object.assign(shader.uniforms, FLOW_UNIFORMS, {
    uFlowSource: data.flowSource,
    uFlowMode: { value: data.flowMode },
    uFlowSpeed: { value: data.flowSpeed },
    uFlowGain: { value: data.flowGain },
  });
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${FLOW_VERTEX}`)
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>\n  vFlowWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vFlowPath = ${FLOW_PATH_ATTRIBUTE};`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${FLOW_FRAGMENT}`)
    .replace(
      "vec4 diffuseColor = vec4( diffuse, opacity );",
      "vec4 diffuseColor = vec4( diffuse, opacity * flowGlow() );",
    );
  injectBreath(shader, this);
}

const materials = new Map<FlowKind, THREE.MeshBasicMaterial>();

/** Produces or retrieves cached shared flow overlay material for specified vessel kind. */
export function flowMaterial(kind: FlowKind): THREE.MeshBasicMaterial {
  let mat = materials.get(kind);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: FLOW_COLOUR[kind],
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    mat.userData = {
      flowSource: FLOW_SOURCES[kind],
      flowMode: FLOW_MODE[kind],
      flowGain: FLOW_GAIN[kind],
      flowSpeed: kind === "pulmonary_artery" ? FLOW_SHAPE.pulmonarySpeed : FLOW_SHAPE.arterySpeed,
      breathRole: kind.startsWith("pulmonary") ? BREATH_ROLE.lung : BREATH_ROLE.vessel,
    };
    mat.onBeforeCompile = flowOnBeforeCompile;
    materials.set(kind, mat);
  }
  return mat;
}

/** Returns collection of all instantiated flow materials for viewport clipping updates. */
export function flowMaterials(): Iterable<THREE.MeshBasicMaterial> {
  return materials.values();
}

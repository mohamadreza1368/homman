import * as THREE from "three";

/**
 * HOOMAAN 3-Point Studio & Cross-Section Lighting Engine.
 * Provides camera-synchronized key, fill, and rim lights with presets
 * and temporary target redirection for axial tomographic slabs.
 */

export interface StudioDirections {
  key: THREE.Vector3;
  fill: THREE.Vector3;
  rim: THREE.Vector3;
}

const KEY_OFFSET = { side: 0.55, up: 0.6 };
const FILL_OFFSET = { side: -0.8, up: -0.2 };
const RIM_OFFSET = { side: 0.25, up: 0.55 };

export function studioLightDirections(
  forward: THREE.Vector3,
  up: THREE.Vector3,
  target?: StudioDirections,
): StudioDirections {
  const result = target ?? {
    key: new THREE.Vector3(),
    fill: new THREE.Vector3(),
    rim: new THREE.Vector3(),
  };

  const dir = forward.clone().normalize();
  const side = new THREE.Vector3().crossVectors(dir, up);
  if (side.lengthSq() < 1e-8) {
    side.set(1, 0, 0).cross(dir);
    if (side.lengthSq() < 1e-8) side.set(0, 0, 1).cross(dir);
  }
  side.normalize();

  const normalUp = new THREE.Vector3().crossVectors(side, dir).normalize();
  const fromViewer = dir.clone().negate();

  result.key
    .copy(fromViewer)
    .addScaledVector(side, KEY_OFFSET.side)
    .addScaledVector(normalUp, KEY_OFFSET.up)
    .normalize();

  result.fill
    .copy(fromViewer)
    .addScaledVector(side, FILL_OFFSET.side)
    .addScaledVector(normalUp, FILL_OFFSET.up)
    .normalize();

  result.rim
    .copy(dir)
    .addScaledVector(side, RIM_OFFSET.side)
    .addScaledVector(normalUp, RIM_OFFSET.up)
    .normalize();

  return result;
}

export const STUDIO_KEY = "studio-key";
export const STUDIO_FILL = "studio-fill";
export const STUDIO_RIM = "studio-rim";
export const STUDIO_AMBIENT = "studio-ambient";

export type LightingPresetId = "studio" | "surgical" | "radiology";

export interface LightingPreset {
  id: LightingPresetId;
  label: string;
  labelFa: string;
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
  fillColor: string;
  rimColor: string;
  bounceIntensity: number;
  bounceColor: string;
  ambientMultiplier: number;
}

export const LIGHTING_PRESETS: Record<LightingPresetId, LightingPreset> = {
  studio: {
    id: "studio",
    label: "Studio Anatomy",
    labelFa: "استودیوی کالبدشناسی",
    keyIntensity: 1.85,
    fillIntensity: 0.55,
    rimIntensity: 0.85,
    fillColor: "#a8cfe8",
    rimColor: "#8fd4ff",
    bounceIntensity: 0.22,
    bounceColor: "#ffd8c0",
    ambientMultiplier: 1.0,
  },
  surgical: {
    id: "surgical",
    label: "Surgical Theater",
    labelFa: "اتاق عمل / جراحی",
    keyIntensity: 2.3,
    fillIntensity: 0.7,
    rimIntensity: 0.95,
    fillColor: "#e0f2fe",
    rimColor: "#38bdf8",
    bounceIntensity: 0.35,
    bounceColor: "#fed7aa",
    ambientMultiplier: 1.25,
  },
  radiology: {
    id: "radiology",
    label: "High Contrast / Bone",
    labelFa: "کنتراست بالا / استخوان",
    keyIntensity: 2.1,
    fillIntensity: 0.3,
    rimIntensity: 1.2,
    fillColor: "#64748b",
    rimColor: "#67e8f9",
    bounceIntensity: 0.1,
    bounceColor: "#cbd5e1",
    ambientMultiplier: 0.8,
  },
};

const RIG_DISTANCE = 10;
export const SECTION_AMBIENT = 0.45;

export interface SectionLighting {
  ambientFloor?: number;
  key?: THREE.Vector3 | undefined;
  support?: number;
}

export function aimStudioAt(
  scene: THREE.Object3D,
  forward: THREE.Vector3,
  up: THREE.Vector3,
  lighting: SectionLighting = {},
): () => void {
  const { ambientFloor = SECTION_AMBIENT, key: keyOverride, support = 1 } = lighting;
  const dirs = studioLightDirections(forward, up);
  const restoreList: {
    light: THREE.Light;
    position: THREE.Vector3;
    intensity: number;
  }[] = [];

  const updateLight = (name: string, dir: THREE.Vector3, scale: number) => {
    const light = scene.getObjectByName(name) as THREE.Light | undefined;
    if (!light) return;
    restoreList.push({ light, position: light.position.clone(), intensity: light.intensity });
    light.position.copy(dir).multiplyScalar(RIG_DISTANCE);
    light.intensity *= scale;
  };

  updateLight(STUDIO_KEY, keyOverride ?? dirs.key, 1);
  updateLight(STUDIO_FILL, dirs.fill, support);
  updateLight(STUDIO_RIM, dirs.rim, support);

  const ambient = scene.getObjectByName(STUDIO_AMBIENT) as THREE.AmbientLight | undefined;
  const initialAmbient = ambient?.intensity ?? 0;
  if (ambient) {
    ambient.intensity = Math.max(initialAmbient, ambientFloor);
  }

  return () => {
    for (const saved of restoreList) {
      saved.light.position.copy(saved.position);
      saved.light.intensity = saved.intensity;
    }
    if (ambient) {
      ambient.intensity = initialAmbient;
    }
  };
}

const HORIZON_ELEVATION_RAD = (20 * Math.PI) / 180;

export function rakingKey(forward: THREE.Vector3, up: THREE.Vector3): THREE.Vector3 {
  const dirs = studioLightDirections(forward, up);
  const viewNorm = forward.clone().normalize();
  const planeTangent = dirs.key.clone().projectOnPlane(viewNorm);

  if (planeTangent.lengthSq() < 1e-8) {
    planeTangent.set(1, 0, 0).projectOnPlane(forward);
  }
  planeTangent.normalize();

  return planeTangent
    .multiplyScalar(Math.cos(HORIZON_ELEVATION_RAD))
    .addScaledVector(viewNorm.negate(), Math.sin(HORIZON_ELEVATION_RAD))
    .normalize();
}

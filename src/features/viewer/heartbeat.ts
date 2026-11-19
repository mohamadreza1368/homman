/**
 * Hoomaan 3D Viewer - Cardiac Chamber Kinematics, Mesh Seam Constraints & Shader Driver
 */

import * as THREE from "three";
import type { Material } from "three";
import type { ManifestOrgan } from "@/lib/schemas";
import { injectBreath } from "./breathing";

export type Chamber =
  | "right_atrium"
  | "left_atrium"
  | "right_ventricle"
  | "left_ventricle";

type HeartCandidate = Pick<ManifestOrgan, "system" | "ta2_latin" | "path">;

const RIGHT = /dext(e)?r/;
const LEFT = /sinist(e)?r/;

/** Resolves heart chamber assignment for anatomical structures. */
export function beatChamber(organ: HeartCandidate): Chamber | null {
  if (organ.system !== "cardiovascular") return null;
  const path = organ.path ?? [];
  if (!path.includes("Heart") && !path.includes("Cardiac vessels")) return null;

  const name = organ.ta2_latin.toLowerCase();
  if (/\batrium\b|\bauricula\b/.test(name)) {
    return RIGHT.test(name) ? "right_atrium" : "left_atrium";
  }
  if (/aortae/.test(name)) return "left_ventricle";
  if (/trunci pulmonalis/.test(name)) return "right_ventricle";
  if (/circumflexa|interventricularis/.test(name)) return "left_ventricle";
  if (/magna cordis|media cordis|sinus coronarius/.test(name)) return "left_ventricle";
  if (LEFT.test(name)) return "left_ventricle";
  if (RIGHT.test(name)) return "right_ventricle";
  return null;
}

export function isAtrium(chamber: Chamber): boolean {
  return chamber === "right_atrium" || chamber === "left_atrium";
}

export function isChamberWall(organ: Pick<ManifestOrgan, "ta2_latin">): boolean {
  return /^(atrium|ventriculus)\b/i.test(organ.ta2_latin);
}

export const RESTING_BPM = 72;

export const CYCLE = {
  atria: { start: 0, peak: 0.05, end: 0.12 },
  ventricles: { start: 0.14, peak: 0.26, end: 0.44 },
  s1: 0.14,
  s2: 0.42,
} as const;

export const SQUEEZE = { atria: 0.08, ventricles: 0.08 } as const;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function bump(t: number, phase: { start: number; peak: number; end: number }): number {
  if (t <= phase.start || t >= phase.end) return 0;
  return t < phase.peak
    ? smooth((t - phase.start) / (phase.peak - phase.start))
    : 1 - smooth((t - phase.peak) / (phase.end - phase.peak));
}

export function beatAt(
  seconds: number,
  bpm = RESTING_BPM,
): { atria: number; ventricles: number } {
  const period = 60 / bpm;
  const t = ((seconds % period) + period) % period;
  return {
    atria: SQUEEZE.atria * bump(t, CYCLE.atria),
    ventricles: SQUEEZE.ventricles * bump(t, CYCLE.ventricles),
  };
}

export function passed(
  before: number,
  after: number,
  mark: number,
  bpm = RESTING_BPM,
): boolean {
  if (!(after > before)) return false;
  const period = 60 / bpm;
  const next = mark + (Math.floor((before - mark) / period) + 1) * period;
  return next <= after;
}

export const BEAT_ATRIA = { value: 0 };
export const BEAT_VENTRICLES = { value: 0 };
export const BEAT_GLOW = { value: 0 };
export const BEAT_LIGHT_ATRIA = { value: 0 };
export const BEAT_LIGHT_VENTRICLES = { value: 0 };

export const BLOOD_HEX = { right: "#3563c9", left: "#e0392c" } as const;
export const BLOOD_RIGHT = new THREE.Color(BLOOD_HEX.right);
export const BLOOD_LEFT = new THREE.Color(BLOOD_HEX.left);

export const CHAMBER_GLOW = { rest: 0.06, contracted: 0.22 } as const;

export const BEAT_BASE_ATRIA = { value: 0 };
export const BEAT_BASE_VENTRICLES = { value: 0 };
export const BEAT_REACH_ATRIA = { value: 0 };
export const BEAT_REACH_VENTRICLES = { value: 0 };

export const HOLD_FRACTION = 0.35;
export const SEAM_NEAR = 0.004;
export const SEAM_FAR = 0.015;
export const SEAM_SPACING = 0.004;
export const SEAM_ATTRIBUTE = "beatSeamFree";

export const HEART_PROBE = { seamMs: -1 };

type Shader = Parameters<Material["onBeforeCompile"]>[0];

export function heartbeatOnBeforeCompile(this: unknown, shader: Shader): void {
  const chunk = "#include <project_vertex>";
  if (!shader.vertexShader.includes(chunk)) {
    throw new Error("Heartbeat: the expected three.js vertex chunk is missing.");
  }
  const owner = this as
    | {
        userData?: {
          beatAtrium?: number;
          beatLeft?: number;
          beatCentre?: { value: THREE.Vector3 };
        };
      }
    | undefined;

  shader.uniforms.uBeatAtria = BEAT_ATRIA;
  shader.uniforms.uBeatVentricles = BEAT_VENTRICLES;
  shader.uniforms.uBeatBaseAtria = BEAT_BASE_ATRIA;
  shader.uniforms.uBeatBaseVentricles = BEAT_BASE_VENTRICLES;
  shader.uniforms.uBeatReachAtria = BEAT_REACH_ATRIA;
  shader.uniforms.uBeatReachVentricles = BEAT_REACH_VENTRICLES;
  shader.uniforms.uBeatIsAtrium = { value: owner?.userData?.beatAtrium ?? 0 };
  shader.uniforms.uBeatGlow = BEAT_GLOW;
  shader.uniforms.uBeatLightAtria = BEAT_LIGHT_ATRIA;
  shader.uniforms.uBeatLightVentricles = BEAT_LIGHT_VENTRICLES;
  shader.uniforms.uBeatBlood = {
    value: owner?.userData?.beatLeft ? BLOOD_LEFT : BLOOD_RIGHT,
  };
  shader.uniforms.uBeatCentre = owner?.userData?.beatCentre ?? {
    value: new THREE.Vector3(),
  };

  shader.vertexShader =
    `attribute float ${SEAM_ATTRIBUTE};\n` +
    "uniform float uBeatAtria;\nuniform float uBeatVentricles;\n" +
    "uniform float uBeatBaseAtria;\nuniform float uBeatBaseVentricles;\n" +
    "uniform float uBeatReachAtria;\nuniform float uBeatReachVentricles;\n" +
    "uniform float uBeatIsAtrium;\nuniform vec3 uBeatCentre;\n" +
    shader.vertexShader.replace(
      chunk,
      `float beatSqueeze = mix(uBeatVentricles, uBeatAtria, uBeatIsAtrium);
float beatBase = mix(uBeatBaseVentricles, uBeatBaseAtria, uBeatIsAtrium);
float beatReach = mix(uBeatReachVentricles, uBeatReachAtria, uBeatIsAtrium);
float beatBelow = beatBase - (modelMatrix * vec4(transformed, 1.0)).y;
float beatFree = beatReach > 0.0 ? smoothstep(0.0, beatReach, beatBelow) : 1.0;
transformed = mix(transformed, uBeatCentre, beatSqueeze * beatFree * ${SEAM_ATTRIBUTE});
${chunk}`,
    );

  const opaque = "#include <opaque_fragment>";
  if (shader.fragmentShader.includes(opaque)) {
    shader.fragmentShader =
      "uniform float uBeatLightAtria;\nuniform float uBeatLightVentricles;\nuniform float uBeatIsAtrium;\n" +
      "uniform float uBeatGlow;\nuniform vec3 uBeatBlood;\n" +
      shader.fragmentShader.replace(
        opaque,
        `float beatContraction = clamp(mix(uBeatLightVentricles, uBeatLightAtria, uBeatIsAtrium), 0.0, 1.0);
float beatGlow = uBeatGlow * (${CHAMBER_GLOW.rest.toFixed(3)} + ${CHAMBER_GLOW.contracted.toFixed(3)} * beatContraction);
outgoingLight = mix(outgoingLight, uBeatBlood, beatGlow);
diffuseColor.a = max(diffuseColor.a, beatGlow);
${opaque}`,
      );
  }

  injectBreath(shader, this);
}

export interface BeatingMesh {
  mesh: THREE.Mesh;
  chamber: Chamber;
  wall: boolean;
  centre: { value: THREE.Vector3 };
}

export const BEATING = new Map<string, BeatingMesh>();
export const BEATING_VERSION = { value: 0 };

export function registerBeating(organId: string, entry: BeatingMesh): () => void {
  BEATING.set(organId, entry);
  BEATING_VERSION.value += 1;
  return () => {
    if (BEATING.get(organId) !== entry) return;
    BEATING.delete(organId);
    BEATING_VERSION.value += 1;
  };
}

type Placed = Pick<ManifestOrgan, "organ_id" | "system" | "ta2_latin" | "path">;

function wallGroups(
  boxes: ReadonlyMap<string, THREE.Box3>,
  organs: readonly Placed[],
): { atria: THREE.Box3; ventricles: THREE.Box3 } {
  const atria = new THREE.Box3();
  const ventricles = new THREE.Box3();
  for (const organ of organs) {
    const chamber = beatChamber(organ);
    const box = boxes.get(organ.organ_id);
    if (!chamber || !box || box.isEmpty() || !isChamberWall(organ)) continue;
    (isAtrium(chamber) ? atria : ventricles).union(box);
  }
  return { atria, ventricles };
}

export interface Hold {
  base: number;
  reach: number;
}

export function chamberHolds(
  boxes: ReadonlyMap<string, THREE.Box3>,
  organs: readonly Placed[],
): { atria: Hold | null; ventricles: Hold | null } {
  const { atria, ventricles } = wallGroups(boxes, organs);
  const hold = (box: THREE.Box3): Hold | null =>
    box.isEmpty()
      ? null
      : { base: box.max.y, reach: HOLD_FRACTION * (box.max.y - box.min.y) };
  return { atria: hold(atria), ventricles: hold(ventricles) };
}

export function chamberCentres(
  boxes: ReadonlyMap<string, THREE.Box3>,
  organs: readonly Placed[],
): Map<Chamber, THREE.Vector3> {
  const walls = new Map<Chamber, THREE.Box3>();
  const everything = new Map<Chamber, THREE.Box3>();
  for (const organ of organs) {
    const chamber = beatChamber(organ);
    const box = boxes.get(organ.organ_id);
    if (!chamber || !box || box.isEmpty()) continue;
    const all = everything.get(chamber) ?? new THREE.Box3();
    everything.set(chamber, all.union(box));
    if (isChamberWall(organ)) {
      const wall = walls.get(chamber) ?? new THREE.Box3();
      walls.set(chamber, wall.union(box));
    }
  }
  const centres = new Map<Chamber, THREE.Vector3>();
  for (const [chamber, box] of everything) {
    centres.set(chamber, (walls.get(chamber) ?? box).getCenter(new THREE.Vector3()));
  }
  return centres;
}

export interface Vertices {
  count: number;
  getX(index: number): number;
  getY(index: number): number;
  getZ(index: number): number;
}

export interface ChamberPoints {
  chamber: Chamber;
  vertices: Vertices;
  matrixWorld: THREE.Matrix4;
}

const CHAMBER_INDEX: Readonly<Record<Chamber, number>> = {
  right_atrium: 0,
  left_atrium: 1,
  right_ventricle: 2,
  left_ventricle: 3,
};

export interface SeamGrid {
  cells: Map<number, number[]>;
}

function cellKey(i: number, j: number, k: number): number {
  return (i * 73856093) ^ (j * 19349663) ^ (k * 83492791);
}

export function seamGrid(walls: readonly ChamberPoints[]): SeamGrid {
  const cells = new Map<number, number[]>();
  const taken = new Set<string>();
  for (const wall of walls) {
    const e = wall.matrixWorld.elements;
    const owner = CHAMBER_INDEX[wall.chamber];
    const { vertices } = wall;
    for (let v = 0; v < vertices.count; v++) {
      const x = vertices.getX(v);
      const y = vertices.getY(v);
      const z = vertices.getZ(v);
      const wx = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
      const wy = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
      const wz = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
      const voxel = `${Math.floor(wx / SEAM_SPACING)},${Math.floor(wy / SEAM_SPACING)},${Math.floor(wz / SEAM_SPACING)},${owner}`;
      if (taken.has(voxel)) continue;
      taken.add(voxel);
      const key = cellKey(
        Math.floor(wx / SEAM_FAR),
        Math.floor(wy / SEAM_FAR),
        Math.floor(wz / SEAM_FAR),
      );
      let bucket = cells.get(key);
      if (!bucket) {
        bucket = [];
        cells.set(key, bucket);
      }
      bucket.push(wx, wy, wz, owner);
    }
  }
  return { cells };
}

export function seamFreedom(grid: SeamGrid, target: ChamberPoints): Float32Array {
  const e = target.matrixWorld.elements;
  const own = CHAMBER_INDEX[target.chamber];
  const { vertices } = target;
  const free = new Float32Array(vertices.count);
  const nearSq = SEAM_NEAR * SEAM_NEAR;
  const span = SEAM_FAR - SEAM_NEAR;

  for (let v = 0; v < vertices.count; v++) {
    const x = vertices.getX(v);
    const y = vertices.getY(v);
    const z = vertices.getZ(v);
    const wx = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
    const wy = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
    const wz = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
    const ci = Math.floor(wx / SEAM_FAR);
    const cj = Math.floor(wy / SEAM_FAR);
    const ck = Math.floor(wz / SEAM_FAR);
    let nearest = Infinity;

    search: for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let dk = -1; dk <= 1; dk++) {
          const bucket = grid.cells.get(cellKey(ci + di, cj + dj, ck + dk));
          if (!bucket) continue;
          for (let b = 0; b < bucket.length; b += 4) {
            if (bucket[b + 3] === own) continue;
            const dx = bucket[b]! - wx;
            const dy = bucket[b + 1]! - wy;
            const dz = bucket[b + 2]! - wz;
            const distanceSq = dx * dx + dy * dy + dz * dz;
            if (distanceSq < nearest) {
              nearest = distanceSq;
              if (distanceSq <= nearSq) break search;
            }
          }
        }
      }
    }
    free[v] = smooth((Math.sqrt(nearest) - SEAM_NEAR) / span);
  }
  return free;
}

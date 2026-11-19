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

const LATIN_PATTERNS = {
  right: /dext(e)?r/,
  left: /sinist(e)?r/,
  atrial: /\batrium\b|\bauricula\b/,
  aorta: /aortae/,
  pulmonary: /trunci pulmonalis/,
  coronaryArteryBypass: /circumflexa|interventricularis/,
  coronaryVeins: /magna cordis|media cordis|sinus coronarius/,
} as const;

/** Resolves heart chamber assignment for anatomical structures. */
export function beatChamber(organ: HeartCandidate): Chamber | null {
  if (organ.system !== "cardiovascular") {
    return null;
  }
  const tree = organ.path ?? [];
  const inCardiacSystem = tree.some((p) => p === "Heart" || p === "Cardiac vessels");
  if (!inCardiacSystem) {
    return null;
  }

  const latin = organ.ta2_latin.toLowerCase();

  if (LATIN_PATTERNS.atrial.test(latin)) {
    return LATIN_PATTERNS.right.test(latin) ? "right_atrium" : "left_atrium";
  }

  // Great vessels and valve leaflets
  if (LATIN_PATTERNS.aorta.test(latin)) {
    return "left_ventricle";
  }
  if (LATIN_PATTERNS.pulmonary.test(latin)) {
    return "right_ventricle";
  }
  if (LATIN_PATTERNS.coronaryArteryBypass.test(latin) || LATIN_PATTERNS.coronaryVeins.test(latin)) {
    return "left_ventricle";
  }

  // General lateralization fallback
  if (LATIN_PATTERNS.left.test(latin)) {
    return "left_ventricle";
  }
  if (LATIN_PATTERNS.right.test(latin)) {
    return "right_ventricle";
  }

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

const Hermite = {
  clamp01: (n: number) => Math.min(1, Math.max(0, n)),
  smoothstep: (v: number) => {
    const s = Math.min(1, Math.max(0, v));
    return s * s * (3 - 2 * s);
  },
  interpolateSegment: (
    timeVal: number,
    phaseSpec: { start: number; peak: number; end: number },
  ): number => {
    const { start, peak, end } = phaseSpec;
    if (timeVal <= start || timeVal >= end) return 0;
    if (timeVal < peak) {
      return Hermite.smoothstep((timeVal - start) / (peak - start));
    }
    return 1 - Hermite.smoothstep((timeVal - peak) / (end - peak));
  },
};

export function beatAt(
  seconds: number,
  bpm = RESTING_BPM,
): { atria: number; ventricles: number } {
  const cycleSeconds = 60 / bpm;
  const wrapped = ((seconds % cycleSeconds) + cycleSeconds) % cycleSeconds;
  const aScale = SQUEEZE.atria * Hermite.interpolateSegment(wrapped, CYCLE.atria);
  const vScale = SQUEEZE.ventricles * Hermite.interpolateSegment(wrapped, CYCLE.ventricles);
  return { atria: aScale, ventricles: vScale };
}

export function passed(
  before: number,
  after: number,
  mark: number,
  bpm = RESTING_BPM,
): boolean {
  if (after <= before) {
    return false;
  }
  const period = 60 / bpm;
  const phaseOffset = Math.floor((before - mark) / period) + 1;
  const targetMark = mark + phaseOffset * period;
  return targetMark <= after;
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

interface HeartMaterialHost {
  userData?: {
    beatAtrium?: number;
    beatLeft?: number;
    beatCentre?: { value: THREE.Vector3 };
  };
}

export function heartbeatOnBeforeCompile(this: unknown, shader: Shader): void {
  const targetProjectChunk = "#include <project_vertex>";
  if (!shader.vertexShader.includes(targetProjectChunk)) {
    throw new Error("Heartbeat: the expected three.js vertex chunk is missing.");
  }

  const host = this as HeartMaterialHost | undefined;
  const isAtrialMesh = host?.userData?.beatAtrium ?? 0;
  const isLeftSided = Boolean(host?.userData?.beatLeft);
  const anchorCentre = host?.userData?.beatCentre ?? { value: new THREE.Vector3() };

  Object.assign(shader.uniforms, {
    uBeatAtria: BEAT_ATRIA,
    uBeatVentricles: BEAT_VENTRICLES,
    uBeatBaseAtria: BEAT_BASE_ATRIA,
    uBeatBaseVentricles: BEAT_BASE_VENTRICLES,
    uBeatReachAtria: BEAT_REACH_ATRIA,
    uBeatReachVentricles: BEAT_REACH_VENTRICLES,
    uBeatIsAtrium: { value: isAtrialMesh },
    uBeatGlow: BEAT_GLOW,
    uBeatLightAtria: BEAT_LIGHT_ATRIA,
    uBeatLightVentricles: BEAT_LIGHT_VENTRICLES,
    uBeatBlood: { value: isLeftSided ? BLOOD_LEFT : BLOOD_RIGHT },
    uBeatCentre: anchorCentre,
  });

  const vertexPreamble = [
    `attribute float ${SEAM_ATTRIBUTE};`,
    "uniform float uBeatAtria;",
    "uniform float uBeatVentricles;",
    "uniform float uBeatBaseAtria;",
    "uniform float uBeatBaseVentricles;",
    "uniform float uBeatReachAtria;",
    "uniform float uBeatReachVentricles;",
    "uniform float uBeatIsAtrium;",
    "uniform vec3 uBeatCentre;",
  ].join("\n") + "\n";

  const vertexBody = [
    "float beatSqueeze = mix(uBeatVentricles, uBeatAtria, uBeatIsAtrium);",
    "float beatBase = mix(uBeatBaseVentricles, uBeatBaseAtria, uBeatIsAtrium);",
    "float beatReach = mix(uBeatReachVentricles, uBeatReachAtria, uBeatIsAtrium);",
    "float beatBelow = beatBase - (modelMatrix * vec4(transformed, 1.0)).y;",
    "float beatFree = beatReach > 0.0 ? smoothstep(0.0, beatReach, beatBelow) : 1.0;",
    `transformed = mix(transformed, uBeatCentre, beatSqueeze * beatFree * ${SEAM_ATTRIBUTE});`,
    targetProjectChunk,
  ].join("\n");

  shader.vertexShader = vertexPreamble + shader.vertexShader.replace(targetProjectChunk, vertexBody);

  const targetFragmentChunk = "#include <opaque_fragment>";
  if (shader.fragmentShader.includes(targetFragmentChunk)) {
    const fragmentPreamble = [
      "uniform float uBeatLightAtria;",
      "uniform float uBeatLightVentricles;",
      "uniform float uBeatIsAtrium;",
      "uniform float uBeatGlow;",
      "uniform vec3 uBeatBlood;",
    ].join("\n") + "\n";

    const fragmentBody = [
      "float beatContraction = clamp(mix(uBeatLightVentricles, uBeatLightAtria, uBeatIsAtrium), 0.0, 1.0);",
      `float beatGlow = uBeatGlow * (${CHAMBER_GLOW.rest.toFixed(3)} + ${CHAMBER_GLOW.contracted.toFixed(3)} * beatContraction);`,
      "outgoingLight = mix(outgoingLight, uBeatBlood, beatGlow);",
      "diffuseColor.a = max(diffuseColor.a, beatGlow);",
      targetFragmentChunk,
    ].join("\n");

    shader.fragmentShader = fragmentPreamble + shader.fragmentShader.replace(targetFragmentChunk, fragmentBody);
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
    if (BEATING.get(organId) === entry) {
      BEATING.delete(organId);
      BEATING_VERSION.value += 1;
    }
  };
}

type Placed = Pick<ManifestOrgan, "organ_id" | "system" | "ta2_latin" | "path">;

export interface Hold {
  base: number;
  reach: number;
}

export function chamberHolds(
  boxes: ReadonlyMap<string, THREE.Box3>,
  organs: readonly Placed[],
): { atria: Hold | null; ventricles: Hold | null } {
  const atriaBox = new THREE.Box3();
  const ventricleBox = new THREE.Box3();

  for (const item of organs) {
    if (!isChamberWall(item)) continue;
    const b = boxes.get(item.organ_id);
    if (!b || b.isEmpty()) continue;
    const ch = beatChamber(item);
    if (!ch) continue;

    const targetBox = isAtrium(ch) ? atriaBox : ventricleBox;
    targetBox.union(b);
  }

  const computeHold = (target: THREE.Box3): Hold | null => {
    if (target.isEmpty()) return null;
    const extentY = target.max.y - target.min.y;
    return {
      base: target.max.y,
      reach: HOLD_FRACTION * extentY,
    };
  };

  return {
    atria: computeHold(atriaBox),
    ventricles: computeHold(ventricleBox),
  };
}

export function chamberCentres(
  boxes: ReadonlyMap<string, THREE.Box3>,
  organs: readonly Placed[],
): Map<Chamber, THREE.Vector3> {
  const wallAccumulator = new Map<Chamber, THREE.Box3>();
  const totalAccumulator = new Map<Chamber, THREE.Box3>();

  organs.forEach((organ) => {
    const ch = beatChamber(organ);
    if (!ch) return;
    const box = boxes.get(organ.organ_id);
    if (!box || box.isEmpty()) return;

    const totalBox = totalAccumulator.get(ch) ?? new THREE.Box3();
    totalAccumulator.set(ch, totalBox.union(box));

    if (isChamberWall(organ)) {
      const wallBox = wallAccumulator.get(ch) ?? new THREE.Box3();
      wallAccumulator.set(ch, wallBox.union(box));
    }
  });

  const centreMap = new Map<Chamber, THREE.Vector3>();
  totalAccumulator.forEach((totalBox, ch) => {
    const wallBox = wallAccumulator.get(ch);
    const chosenBox = wallBox && !wallBox.isEmpty() ? wallBox : totalBox;
    centreMap.set(ch, chosenBox.getCenter(new THREE.Vector3()));
  });

  return centreMap;
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

const CHAMBER_CODES: Readonly<Record<Chamber, number>> = Object.freeze({
  right_atrium: 0,
  left_atrium: 1,
  right_ventricle: 2,
  left_ventricle: 3,
});

export interface SeamGrid {
  cells: Map<number, number[]>;
}

function hashCellCoords(cx: number, cy: number, cz: number): number {
  return (cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791);
}

export function seamGrid(walls: readonly ChamberPoints[]): SeamGrid {
  const gridCells = new Map<number, number[]>();
  const seenVoxels = new Set<string>();

  for (const wall of walls) {
    const m = wall.matrixWorld.elements;
    const code = CHAMBER_CODES[wall.chamber];
    const { vertices } = wall;

    for (let idx = 0; idx < vertices.count; idx++) {
      const lx = vertices.getX(idx);
      const ly = vertices.getY(idx);
      const lz = vertices.getZ(idx);

      const wx = m[0]! * lx + m[4]! * ly + m[8]! * lz + m[12]!;
      const wy = m[1]! * lx + m[5]! * ly + m[9]! * lz + m[13]!;
      const wz = m[2]! * lx + m[6]! * ly + m[10]! * lz + m[14]!;

      const voxelTag = `${Math.floor(wx / SEAM_SPACING)}:${Math.floor(wy / SEAM_SPACING)}:${Math.floor(wz / SEAM_SPACING)}:${code}`;
      if (seenVoxels.has(voxelTag)) {
        continue;
      }
      seenVoxels.add(voxelTag);

      const key = hashCellCoords(
        Math.floor(wx / SEAM_FAR),
        Math.floor(wy / SEAM_FAR),
        Math.floor(wz / SEAM_FAR),
      );
      let cellList = gridCells.get(key);
      if (!cellList) {
        cellList = [];
        gridCells.set(key, cellList);
      }
      cellList.push(wx, wy, wz, code);
    }
  }

  return { cells: gridCells };
}

export function seamFreedom(grid: SeamGrid, target: ChamberPoints): Float32Array {
  const elements = target.matrixWorld.elements;
  const targetCode = CHAMBER_CODES[target.chamber];
  const { vertices } = target;
  const freedomArray = new Float32Array(vertices.count);
  const cutoffSq = SEAM_NEAR * SEAM_NEAR;
  const distanceSpan = SEAM_FAR - SEAM_NEAR;

  for (let idx = 0; idx < vertices.count; idx++) {
    const lx = vertices.getX(idx);
    const ly = vertices.getY(idx);
    const lz = vertices.getZ(idx);

    const gx = elements[0]! * lx + elements[4]! * ly + elements[8]! * lz + elements[12]!;
    const gy = elements[1]! * lx + elements[5]! * ly + elements[9]! * lz + elements[13]!;
    const gz = elements[2]! * lx + elements[6]! * ly + elements[10]! * lz + elements[14]!;

    const cx = Math.floor(gx / SEAM_FAR);
    const cy = Math.floor(gy / SEAM_FAR);
    const cz = Math.floor(gz / SEAM_FAR);

    let minDistanceSq = Infinity;

    neighborSearch: for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.cells.get(hashCellCoords(cx + dx, cy + dy, cz + dz));
          if (!list) continue;

          for (let p = 0; p < list.length; p += 4) {
            if (list[p + 3] === targetCode) continue;

            const diffX = list[p]! - gx;
            const diffY = list[p + 1]! - gy;
            const diffZ = list[p + 2]! - gz;
            const distSq = diffX * diffX + diffY * diffY + diffZ * diffZ;

            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              if (distSq <= cutoffSq) {
                break neighborSearch;
              }
            }
          }
        }
      }
    }

    const dist = Math.sqrt(minDistanceSq);
    freedomArray[idx] = Hermite.smoothstep((dist - SEAM_NEAR) / distanceSpan);
  }

  return freedomArray;
}

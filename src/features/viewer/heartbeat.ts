/**
 * HOOMAAN 3D Viewer - Cardiac Chamber Kinematics, Seam Constraints & GLSL Shader Pipeline
 * Clean-room architecture for anatomical chamber identification, spatial vertex anchoring,
 * and electromechanical contraction animation.
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

type CandidateStructure = Pick<ManifestOrgan, "system" | "ta2_latin" | "path">;

export const RESTING_BPM = 72;
export const SQUEEZE = Object.freeze({ atria: 0.08, ventricles: 0.08 } as const);

export const CYCLE = Object.freeze({
  atria: { start: 0, peak: 0.05, end: 0.12 },
  ventricles: { start: 0.14, peak: 0.26, end: 0.44 },
  s1: 0.14,
  s2: 0.42,
} as const);

export const HOLD_FRACTION = 0.35;
export const SEAM_NEAR = 0.004;
export const SEAM_FAR = 0.015;
export const SEAM_SPACING = 0.004;
export const SEAM_ATTRIBUTE = "beatSeamFree";

export const BLOOD_HEX = Object.freeze({ right: "#3563c9", left: "#e0392c" } as const);
export const BLOOD_RIGHT = new THREE.Color(BLOOD_HEX.right);
export const BLOOD_LEFT = new THREE.Color(BLOOD_HEX.left);

export const CHAMBER_GLOW = Object.freeze({ rest: 0.06, contracted: 0.22 } as const);

export const BEAT_ATRIA = { value: 0 };
export const BEAT_VENTRICLES = { value: 0 };
export const BEAT_GLOW = { value: 0 };
export const BEAT_LIGHT_ATRIA = { value: 0 };
export const BEAT_LIGHT_VENTRICLES = { value: 0 };

export const BEAT_BASE_ATRIA = { value: 0 };
export const BEAT_BASE_VENTRICLES = { value: 0 };
export const BEAT_REACH_ATRIA = { value: 0 };
export const BEAT_REACH_VENTRICLES = { value: 0 };

export const HEART_PROBE = { seamMs: -1 };

export interface BeatingMesh {
  mesh: THREE.Mesh;
  chamber: Chamber;
  wall: boolean;
  centre: { value: THREE.Vector3 };
}

export const BEATING = new Map<string, BeatingMesh>();
export const BEATING_VERSION = { value: 0 };

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

export interface Hold {
  base: number;
  reach: number;
}

export interface SeamGrid {
  cells: Map<number, number[]>;
}

const CHAMBER_INDICES: Readonly<Record<Chamber, number>> = Object.freeze({
  right_atrium: 0,
  left_atrium: 1,
  right_ventricle: 2,
  left_ventricle: 3,
});

/**
 * Maps an anatomical structure to its functional cardiac chamber.
 */
export function beatChamber(organ: CandidateStructure): Chamber | null {
  if (organ.system !== "cardiovascular") return null;

  const hierarchy = organ.path ?? [];
  const isHeartTree = hierarchy.includes("Heart") || hierarchy.includes("Cardiac vessels");
  if (!isHeartTree) return null;

  const name = organ.ta2_latin.toLowerCase();
  const isRight = /dext(e)?r/.test(name);
  const isLeft = /sinist(e)?r/.test(name);

  if (/\batrium\b|\bauricula\b/.test(name)) {
    return isRight ? "right_atrium" : "left_atrium";
  }

  if (/aortae/.test(name)) return "left_ventricle";
  if (/trunci pulmonalis/.test(name)) return "right_ventricle";
  if (/circumflexa|interventricularis|magna cordis|media cordis|sinus coronarius/.test(name)) {
    return "left_ventricle";
  }

  if (isLeft) return "left_ventricle";
  if (isRight) return "right_ventricle";

  return null;
}

export function isAtrium(chamber: Chamber): boolean {
  return chamber === "right_atrium" || chamber === "left_atrium";
}

export function isChamberWall(organ: Pick<ManifestOrgan, "ta2_latin">): boolean {
  return /^(atrium|ventriculus)\b/i.test(organ.ta2_latin);
}

function smoothInterpolation(val: number): number {
  const clamped = Math.min(1, Math.max(0, val));
  return clamped * clamped * (3 - 2 * clamped);
}

function sampleCurveSegment(t: number, boundary: { start: number; peak: number; end: number }): number {
  if (t <= boundary.start || t >= boundary.end) return 0;
  if (t < boundary.peak) {
    return smoothInterpolation((t - boundary.start) / (boundary.peak - boundary.start));
  }
  return 1 - smoothInterpolation((t - boundary.peak) / (boundary.end - boundary.peak));
}

export function beatAt(elapsedSeconds: number, heartRate: number = RESTING_BPM): { atria: number; ventricles: number } {
  const period = 60 / heartRate;
  const normalizedTime = ((elapsedSeconds % period) + period) % period;

  const atrialCoeff = SQUEEZE.atria * sampleCurveSegment(normalizedTime, CYCLE.atria);
  const ventricularCoeff = SQUEEZE.ventricles * sampleCurveSegment(normalizedTime, CYCLE.ventricles);

  return { atria: atrialCoeff, ventricles: ventricularCoeff };
}

export function passed(previousTime: number, currentTime: number, phaseMark: number, heartRate: number = RESTING_BPM): boolean {
  if (currentTime <= previousTime) return false;
  const cyclePeriod = 60 / heartRate;
  const intervalIndex = Math.floor((previousTime - phaseMark) / cyclePeriod) + 1;
  const eventTime = phaseMark + intervalIndex * cyclePeriod;
  return eventTime <= currentTime;
}

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

export function chamberHolds(
  boxes: ReadonlyMap<string, THREE.Box3>,
  organs: readonly Pick<ManifestOrgan, "organ_id" | "system" | "ta2_latin" | "path">[],
): { atria: Hold | null; ventricles: Hold | null } {
  const atriumUnion = new THREE.Box3();
  const ventricleUnion = new THREE.Box3();

  for (const organ of organs) {
    if (!isChamberWall(organ)) continue;
    const b = boxes.get(organ.organ_id);
    if (!b || b.isEmpty()) continue;
    const ch = beatChamber(organ);
    if (!ch) continue;

    if (isAtrium(ch)) {
      atriumUnion.union(b);
    } else {
      ventricleUnion.union(b);
    }
  }

  const buildHold = (b: THREE.Box3): Hold | null => {
    if (b.isEmpty()) return null;
    return {
      base: b.max.y,
      reach: HOLD_FRACTION * (b.max.y - b.min.y),
    };
  };

  return {
    atria: buildHold(atriumUnion),
    ventricles: buildHold(ventricleUnion),
  };
}

export function chamberCentres(
  boxes: ReadonlyMap<string, THREE.Box3>,
  organs: readonly Pick<ManifestOrgan, "organ_id" | "system" | "ta2_latin" | "path">[],
): Map<Chamber, THREE.Vector3> {
  const wallBoxes = new Map<Chamber, THREE.Box3>();
  const allBoxes = new Map<Chamber, THREE.Box3>();

  for (const organ of organs) {
    const ch = beatChamber(organ);
    if (!ch) continue;
    const b = boxes.get(organ.organ_id);
    if (!b || b.isEmpty()) continue;

    const aggregate = allBoxes.get(ch) ?? new THREE.Box3();
    allBoxes.set(ch, aggregate.union(b));

    if (isChamberWall(organ)) {
      const wallAgg = wallBoxes.get(ch) ?? new THREE.Box3();
      wallBoxes.set(ch, wallAgg.union(b));
    }
  }

  const results = new Map<Chamber, THREE.Vector3>();
  for (const [ch, totalBox] of allBoxes.entries()) {
    const wallBox = wallBoxes.get(ch);
    const primaryBox = wallBox && !wallBox.isEmpty() ? wallBox : totalBox;
    results.set(ch, primaryBox.getCenter(new THREE.Vector3()));
  }

  return results;
}

function computeSpatialHash(xCoord: number, yCoord: number, zCoord: number): number {
  return (xCoord * 73856093) ^ (yCoord * 19349663) ^ (zCoord * 83492791);
}

export function seamGrid(walls: readonly ChamberPoints[]): SeamGrid {
  const bucketMap = new Map<number, number[]>();
  const visitedVoxelTokens = new Set<string>();

  for (const wall of walls) {
    const mat = wall.matrixWorld.elements;
    const chamberCode = CHAMBER_INDICES[wall.chamber];
    const { vertices } = wall;

    for (let i = 0; i < vertices.count; i++) {
      const lx = vertices.getX(i);
      const ly = vertices.getY(i);
      const lz = vertices.getZ(i);

      const wx = mat[0]! * lx + mat[4]! * ly + mat[8]! * lz + mat[12]!;
      const wy = mat[1]! * lx + mat[5]! * ly + mat[9]! * lz + mat[13]!;
      const wz = mat[2]! * lx + mat[6]! * ly + mat[10]! * lz + mat[14]!;

      const voxelKey = `${Math.floor(wx / SEAM_SPACING)}:${Math.floor(wy / SEAM_SPACING)}:${Math.floor(wz / SEAM_SPACING)}:${chamberCode}`;
      if (visitedVoxelTokens.has(voxelKey)) continue;
      visitedVoxelTokens.add(voxelKey);

      const cellHash = computeSpatialHash(
        Math.floor(wx / SEAM_FAR),
        Math.floor(wy / SEAM_FAR),
        Math.floor(wz / SEAM_FAR),
      );

      let record = bucketMap.get(cellHash);
      if (!record) {
        record = [];
        bucketMap.set(cellHash, record);
      }
      record.push(wx, wy, wz, chamberCode);
    }
  }

  return { cells: bucketMap };
}

export function seamFreedom(grid: SeamGrid, target: ChamberPoints): Float32Array {
  const mat = target.matrixWorld.elements;
  const selfCode = CHAMBER_INDICES[target.chamber];
  const { vertices } = target;
  const freedomCoeffs = new Float32Array(vertices.count);

  const thresholdSq = SEAM_NEAR * SEAM_NEAR;
  const span = SEAM_FAR - SEAM_NEAR;

  for (let i = 0; i < vertices.count; i++) {
    const lx = vertices.getX(i);
    const ly = vertices.getY(i);
    const lz = vertices.getZ(i);

    const gx = mat[0]! * lx + mat[4]! * ly + mat[8]! * lz + mat[12]!;
    const gy = mat[1]! * lx + mat[5]! * ly + mat[9]! * lz + mat[13]!;
    const gz = mat[2]! * lx + mat[6]! * ly + mat[10]! * lz + mat[14]!;

    const cellX = Math.floor(gx / SEAM_FAR);
    const cellY = Math.floor(gy / SEAM_FAR);
    const cellZ = Math.floor(gz / SEAM_FAR);

    let nearestDistSq = Infinity;

    searchLoop: for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const points = grid.cells.get(computeSpatialHash(cellX + dx, cellY + dy, cellZ + dz));
          if (!points) continue;

          for (let p = 0; p < points.length; p += 4) {
            if (points[p + 3] === selfCode) continue;

            const diffX = points[p]! - gx;
            const diffY = points[p + 1]! - gy;
            const diffZ = points[p + 2]! - gz;
            const distSq = diffX * diffX + diffY * diffY + diffZ * diffZ;

            if (distSq < nearestDistSq) {
              nearestDistSq = distSq;
              if (distSq <= thresholdSq) break searchLoop;
            }
          }
        }
      }
    }

    const euclideanDist = Math.sqrt(nearestDistSq);
    freedomCoeffs[i] = smoothInterpolation((euclideanDist - SEAM_NEAR) / span);
  }

  return freedomCoeffs;
}

type Shader = Parameters<Material["onBeforeCompile"]>[0];

interface MaterialHostMetadata {
  userData?: {
    beatAtrium?: number;
    beatLeft?: number;
    beatCentre?: { value: THREE.Vector3 };
  };
}

export function heartbeatOnBeforeCompile(this: unknown, shader: Shader): void {
  const projectHook = "#include <project_vertex>";
  if (!shader.vertexShader.includes(projectHook)) {
    throw new Error("Missing expected three.js vertex projection hook in shader compilation.");
  }

  const hostContext = this as MaterialHostMetadata | undefined;
  const isAtriumMesh = hostContext?.userData?.beatAtrium ?? 0;
  const isLeftVessel = Boolean(hostContext?.userData?.beatLeft);
  const anatomicalCentre = hostContext?.userData?.beatCentre ?? { value: new THREE.Vector3() };

  Object.assign(shader.uniforms, {
    uBeatAtria: BEAT_ATRIA,
    uBeatVentricles: BEAT_VENTRICLES,
    uBeatBaseAtria: BEAT_BASE_ATRIA,
    uBeatBaseVentricles: BEAT_BASE_VENTRICLES,
    uBeatReachAtria: BEAT_REACH_ATRIA,
    uBeatReachVentricles: BEAT_REACH_VENTRICLES,
    uBeatIsAtrium: { value: isAtriumMesh },
    uBeatGlow: BEAT_GLOW,
    uBeatLightAtria: BEAT_LIGHT_ATRIA,
    uBeatLightVentricles: BEAT_LIGHT_VENTRICLES,
    uBeatBlood: { value: isLeftVessel ? BLOOD_LEFT : BLOOD_RIGHT },
    uBeatCentre: anatomicalCentre,
  });

  const vertexUniformDefinitions = [
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

  const vertexDisplacementOperations = [
    "float beatSqueeze = mix(uBeatVentricles, uBeatAtria, uBeatIsAtrium);",
    "float beatBase = mix(uBeatBaseVentricles, uBeatBaseAtria, uBeatIsAtrium);",
    "float beatReach = mix(uBeatReachVentricles, uBeatReachAtria, uBeatIsAtrium);",
    "float beatBelow = beatBase - (modelMatrix * vec4(transformed, 1.0)).y;",
    "float beatFree = beatReach > 0.0 ? smoothstep(0.0, beatReach, beatBelow) : 1.0;",
    `float beatFactor = beatSqueeze * beatFree * ${SEAM_ATTRIBUTE};`,
    "vec3 vRel = transformed - uBeatCentre;",
    "if (uBeatIsAtrium > 0.5) {",
    "  transformed -= vRel * (beatFactor * 0.75);",
    "} else {",
    "  float heightAboveApex = max(0.0, vRel.y + 0.04);",
    "  float yShortening = -beatFactor * heightAboveApex * 0.55;",
    "  float twistAngle = beatFactor * 0.35 * (0.05 - vRel.y);",
    "  float cosT = cos(twistAngle);",
    "  float sinT = sin(twistAngle);",
    "  vec2 twistedXZ = vec2(vRel.x * cosT - vRel.z * sinT, vRel.x * sinT + vRel.z * cosT);",
    "  vec2 radialContracted = twistedXZ * (1.0 - beatFactor * 0.65);",
    "  transformed.x = uBeatCentre.x + radialContracted.x;",
    "  transformed.z = uBeatCentre.z + radialContracted.y;",
    "  transformed.y += yShortening;",
    "}",
    projectHook,
  ].join("\n");

  shader.vertexShader = vertexUniformDefinitions + shader.vertexShader.replace(projectHook, vertexDisplacementOperations);

  const fragmentHook = "#include <opaque_fragment>";
  if (shader.fragmentShader.includes(fragmentHook)) {
    const fragmentUniformDefinitions = [
      "uniform float uBeatLightAtria;",
      "uniform float uBeatLightVentricles;",
      "uniform float uBeatIsAtrium;",
      "uniform float uBeatGlow;",
      "uniform vec3 uBeatBlood;",
    ].join("\n") + "\n";

    const fragmentColorModulations = [
      "float beatContraction = clamp(mix(uBeatLightVentricles, uBeatLightAtria, uBeatIsAtrium), 0.0, 1.0);",
      `float beatGlow = uBeatGlow * (${CHAMBER_GLOW.rest.toFixed(3)} + ${CHAMBER_GLOW.contracted.toFixed(3)} * beatContraction);`,
      "outgoingLight = mix(outgoingLight, uBeatBlood, beatGlow);",
      "diffuseColor.a = max(diffuseColor.a, beatGlow);",
      fragmentHook,
    ].join("\n");

    shader.fragmentShader = fragmentUniformDefinitions + shader.fragmentShader.replace(fragmentHook, fragmentColorModulations);
  }

  injectBreath(shader, this);
}

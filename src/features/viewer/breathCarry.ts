/**
 * Hoomaan 3D Viewer - Respiratory Visceral Motion Carry & Vessel Stretching
 */

import * as THREE from "three";
import type { Vertices } from "./heartbeat";

export const CARRY_VOXEL = 0.005;
export const CARRY_REACH = 0.02;
export const ANCHOR_NEAR = 0.006;
export const ANCHOR_FAR = 0.02;
export const HEART_NEAR = 0.006;
export const HEART_FAR = 0.015;
export const CARRY_ATTRIBUTE = "breathCarry";

export interface PointSet {
  vertices: Vertices;
  matrixWorld: THREE.Matrix4;
}

export interface CarryField {
  min: THREE.Vector3;
  size: [number, number, number];
  values: Float32Array;
  selective: Float32Array[];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function iterateWorldVertices(
  set: PointSet,
  visit: (x: number, y: number, z: number) => void,
): void {
  const e = set.matrixWorld.elements;
  const { vertices } = set;
  for (let v = 0; v < vertices.count; v++) {
    const x = vertices.getX(v);
    const y = vertices.getY(v);
    const z = vertices.getZ(v);
    visit(
      e[0]! * x + e[4]! * y + e[8]! * z + e[12]!,
      e[1]! * x + e[5]! * y + e[9]! * z + e[13]!,
      e[2]! * x + e[6]! * y + e[10]! * z + e[14]!,
    );
  }
}

function chamferDistanceField(
  seeds: Uint8Array,
  nx: number,
  ny: number,
  nz: number,
): Float32Array {
  const distance = new Float32Array(seeds.length);
  for (let i = 0; i < seeds.length; i++) {
    distance[i] = seeds[i] ? 0 : Infinity;
  }

  const offsets: [number, number, number, number][] = [];
  for (let dz = -1; dz <= 0; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dz === 0 && (dy > 0 || (dy === 0 && dx >= 0))) continue;
        offsets.push([dx, dy, dz, Math.hypot(dx, dy, dz)]);
      }
    }
  }

  const sweep = (forward: boolean) => {
    const sign = forward ? 1 : -1;
    for (let k = forward ? 0 : nz - 1; forward ? k < nz : k >= 0; k += sign) {
      for (let j = forward ? 0 : ny - 1; forward ? j < ny : j >= 0; j += sign) {
        for (let i = forward ? 0 : nx - 1; forward ? i < nx : i >= 0; i += sign) {
          const here = i + nx * (j + ny * k);
          let best = distance[here]!;
          for (const [dx, dy, dz, cost] of offsets) {
            const x = i + sign * dx;
            const y = j + sign * dy;
            const z = k + sign * dz;
            if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue;
            const through = distance[x + nx * (y + ny * z)]! + cost;
            if (through < best) best = through;
          }
          distance[here] = best;
        }
      }
    }
  };

  sweep(true);
  sweep(false);
  return distance;
}

export interface AnchorGroup {
  sets: readonly PointSet[];
  near: number;
  far: number;
  selective?: boolean;
}

/** Computes voxelized volumetric carry influence field for visceral organs and vascular anchors. */
export function carryField(
  carriers: readonly PointSet[],
  anchors: readonly AnchorGroup[],
): CarryField | null {
  const bounds = new THREE.Box3();
  for (const c of carriers) {
    iterateWorldVertices(c, (x, y, z) => bounds.expandByPoint(new THREE.Vector3(x, y, z)));
  }
  if (bounds.isEmpty()) return null;

  bounds.expandByScalar(CARRY_REACH + 3 * CARRY_VOXEL);
  const min = bounds.min.clone();
  const extent = bounds.getSize(new THREE.Vector3());
  const nx = Math.ceil(extent.x / CARRY_VOXEL) + 1;
  const ny = Math.ceil(extent.y / CARRY_VOXEL) + 1;
  const nz = Math.ceil(extent.z / CARRY_VOXEL) + 1;

  const getVoxelIndex = (x: number, y: number, z: number) => {
    const i = Math.floor((x - min.x) / CARRY_VOXEL);
    const j = Math.floor((y - min.y) / CARRY_VOXEL);
    const k = Math.floor((z - min.z) / CARRY_VOXEL);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return -1;
    return i + nx * (j + ny * k);
  };

  const surface = new Uint8Array(nx * ny * nz);
  for (const c of carriers) {
    iterateWorldVertices(c, (x, y, z) => {
      const at = getVoxelIndex(x, y, z);
      if (at >= 0) surface[at] = 1;
    });
  }

  const shell = new Uint8Array(surface.length);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!surface[i + nx * (j + ny * k)]) continue;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const x = i + dx;
              const y = j + dy;
              const z = k + dz;
              if (x >= 0 && y >= 0 && z >= 0 && x < nx && y < ny && z < nz) {
                shell[x + nx * (y + ny * z)] = 1;
              }
            }
          }
        }
      }
    }
  }

  const outside = new Uint8Array(shell.length);
  const queue: number[] = [];
  const pushBoundary = (i: number, j: number, k: number) => {
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return;
    const at = i + nx * (j + ny * k);
    if (shell[at] || outside[at]) return;
    outside[at] = 1;
    queue.push(at);
  };

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) {
          pushBoundary(i, j, k);
        }
      }
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    const i = at % nx;
    const j = Math.floor(at / nx) % ny;
    const k = Math.floor(at / (nx * ny));
    pushBoundary(i - 1, j, k);
    pushBoundary(i + 1, j, k);
    pushBoundary(i, j - 1, k);
    pushBoundary(i, j + 1, k);
    pushBoundary(i, j, k - 1);
    pushBoundary(i, j, k + 1);
  }

  const solid = new Uint8Array(shell.length);
  for (let at = 0; at < solid.length; at++) {
    solid[at] = outside[at] ? 0 : 1;
  }

  const fromOrgan = chamferDistanceField(solid, nx, ny, nz);
  const values = new Float32Array(solid.length);
  for (let at = 0; at < values.length; at++) {
    values[at] = 1 - smoothstep(0, CARRY_REACH, fromOrgan[at]! * CARRY_VOXEL);
  }

  const selective: Float32Array[] = [];
  for (const group of anchors) {
    const anchored = new Uint8Array(shell.length);
    let hasAny = false;
    for (const anchor of group.sets) {
      iterateWorldVertices(anchor, (x, y, z) => {
        const at = getVoxelIndex(x, y, z);
        if (at < 0) return;
        anchored[at] = 1;
        hasAny = true;
      });
    }
    if (!hasAny) continue;

    const fromAnchor = chamferDistanceField(anchored, nx, ny, nz);
    const into = group.selective ? new Float32Array(values.length) : values;
    for (let at = 0; at < values.length; at++) {
      const free = smoothstep(group.near, group.far, fromAnchor[at]! * CARRY_VOXEL);
      into[at] = group.selective ? free : values[at]! * free;
    }
    if (group.selective) selective.push(into);
  }

  return { min, size: [nx, ny, nz], values, selective };
}

/** Interpolates field weight at world coordinate position. */
export function carryAt(
  field: CarryField,
  x: number,
  y: number,
  z: number,
  values = field.values,
): number {
  const [nx, ny, nz] = field.size;
  const fx = (x - field.min.x) / CARRY_VOXEL - 0.5;
  const fy = (y - field.min.y) / CARRY_VOXEL - 0.5;
  const fz = (z - field.min.z) / CARRY_VOXEL - 0.5;

  if (fx < 0 || fy < 0 || fz < 0 || fx > nx - 1 || fy > ny - 1 || fz > nz - 1) return 0;

  const i = Math.min(nx - 2, Math.floor(fx));
  const j = Math.min(ny - 2, Math.floor(fy));
  const k = Math.min(nz - 2, Math.floor(fz));

  const tx = fx - i;
  const ty = fy - j;
  const tz = fz - k;

  const valAt = (a: number, b: number, c: number) =>
    values[i + a + nx * (j + b + ny * (k + c))]!;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return lerp(
    lerp(lerp(valAt(0, 0, 0), valAt(1, 0, 0), tx), lerp(valAt(0, 1, 0), valAt(1, 1, 0), tx), ty),
    lerp(lerp(valAt(0, 0, 1), valAt(1, 0, 1), tx), lerp(valAt(0, 1, 1), valAt(1, 1, 1), tx), ty),
    tz,
  );
}

/** Evaluates vertex weight buffer for target point set against field. */
export function carryWeights(
  field: CarryField,
  target: PointSet,
  joinsHeart = false,
): Float32Array {
  const weights = new Float32Array(target.vertices.count);
  let v = 0;
  iterateWorldVertices(target, (x, y, z) => {
    let weight = carryAt(field, x, y, z);
    if (joinsHeart && weight > 0) {
      for (const hold of field.selective) {
        weight *= carryAt(field, x, y, z, hold);
      }
    }
    weights[v++] = weight;
  });
  return weights;
}

export type CarryPart = "carrier" | "anchor" | "heart" | "vessel" | "vena cava";

export interface CarryMesh {
  mesh: THREE.Mesh;
  part: CarryPart;
}

export const CARRY_MESHES = new Map<string, CarryMesh>();
export const CARRY_VERSION = { value: 0 };

export function registerCarry(organId: string, entry: CarryMesh): () => void {
  CARRY_MESHES.set(organId, entry);
  CARRY_VERSION.value += 1;
  return () => {
    if (CARRY_MESHES.get(organId) !== entry) return;
    CARRY_MESHES.delete(organId);
    CARRY_VERSION.value += 1;
  };
}

export function carryPlacement(): number {
  let sum = 0;
  for (const { mesh } of CARRY_MESHES.values()) {
    const e = mesh.matrixWorld.elements;
    sum += Math.abs(e[12]!) + Math.abs(e[13]!) + Math.abs(e[14]!);
  }
  return sum;
}

export const CARRY_PROBE = { ms: -1, vessels: 0 };

export function measureCarry(): void {
  const startMs = performance.now();
  const toPointSet = (mesh: THREE.Mesh): PointSet => {
    mesh.updateWorldMatrix(true, false);
    return {
      vertices: mesh.geometry.getAttribute("position"),
      matrixWorld: mesh.matrixWorld,
    };
  };

  const entries = [...CARRY_MESHES.values()];
  const byPart = (part: CarryPart) =>
    entries.filter((entry) => entry.part === part).map((entry) => toPointSet(entry.mesh));

  const field = carryField(byPart("carrier"), [
    { sets: byPart("anchor"), near: ANCHOR_NEAR, far: ANCHOR_FAR },
    { sets: byPart("heart"), near: HEART_NEAR, far: HEART_FAR, selective: true },
  ]);

  let updatedVessels = 0;
  if (field) {
    const [nx, ny, nz] = field.size;
    const reachBox = new THREE.Box3(
      field.min.clone(),
      field.min.clone().add(new THREE.Vector3(nx, ny, nz).multiplyScalar(CARRY_VOXEL)),
    );
    const meshBox = new THREE.Box3();

    for (const entry of entries) {
      if (entry.part !== "vessel" && entry.part !== "vena cava") continue;
      const { geometry } = entry.mesh;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      entry.mesh.updateWorldMatrix(true, false);
      meshBox.copy(geometry.boundingBox!).applyMatrix4(entry.mesh.matrixWorld);

      if (!meshBox.intersectsBox(reachBox)) {
        if (geometry.getAttribute(CARRY_ATTRIBUTE)) {
          geometry.deleteAttribute(CARRY_ATTRIBUTE);
        }
        continue;
      }

      const weights = carryWeights(
        field,
        toPointSet(entry.mesh),
        entry.part === "vena cava",
      );
      geometry.setAttribute(CARRY_ATTRIBUTE, new THREE.BufferAttribute(weights, 1));
      updatedVessels += 1;
    }
  }

  CARRY_PROBE.ms = performance.now() - startMs;
  CARRY_PROBE.vessels = updatedVessels;
}

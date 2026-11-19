/**
 * Hoomaan 3D Viewer - Vascular Network Flow Path Distance Calculator
 */

import type * as THREE from "three";
import type { Vertices } from "./heartbeat";

export const PATH_CELL = 0.005;
export const BRIDGE_REACH = 0.12;

export interface PathMesh {
  vertices: Vertices;
  matrixWorld: THREE.Matrix4;
  seed: boolean;
}

const SIDE = 2048;
const HALF = SIDE / 2;
const key = (x: number, y: number, z: number) =>
  x + HALF + (y + HALF) * SIDE + (z + HALF) * SIDE * SIDE;

class MinHeap {
  private items: number[] = [];
  constructor(private readonly dist: Float64Array) {}

  get size(): number {
    return this.items.length;
  }

  push(item: number): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.dist[items[parent]!]! <= this.dist[item]!) break;
      items[i] = items[parent]!;
      i = parent;
    }
    items[i] = item;
  }

  pop(): number {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      let i = 0;
      const n = items.length;
      for (;;) {
        const left = 2 * i + 1;
        if (left >= n) break;
        const right = left + 1;
        const child =
          right < n && this.dist[items[right]!]! < this.dist[items[left]!]! ? right : left;
        if (this.dist[items[child]!]! >= this.dist[last]!) break;
        items[i] = items[child]!;
        i = child;
      }
      items[i] = last;
    }
    return top;
  }
}

/**
 * Computes shortest topological vascular distances from cardiac source origin.
 * Output distances are encoded as d + 1 (with 0 reserved for unreachable segments).
 */
export function flowPaths(
  meshes: readonly PathMesh[],
  origin: THREE.Vector3,
): Float32Array[] {
  const cellOf = new Map<number, number>();
  const cx: number[] = [];
  const cy: number[] = [];
  const cz: number[] = [];
  const count: number[] = [];
  const coords: number[] = [];
  const vertexCells: Int32Array[] = [];
  const seeds = new Map<number, number>();
  let nearest = -1;
  let nearestDistance = Infinity;

  for (const mesh of meshes) {
    const e = mesh.matrixWorld.elements;
    const v = mesh.vertices;
    const cells = new Int32Array(v.count);
    let seedCell = -1;
    let seedDistance = Infinity;

    for (let i = 0; i < v.count; i++) {
      const lx = v.getX(i);
      const ly = v.getY(i);
      const lz = v.getZ(i);
      const x = e[0]! * lx + e[4]! * ly + e[8]! * lz + e[12]!;
      const y = e[1]! * lx + e[5]! * ly + e[9]! * lz + e[13]!;
      const z = e[2]! * lx + e[6]! * ly + e[10]! * lz + e[14]!;

      const gx = Math.floor(x / PATH_CELL);
      const gy = Math.floor(y / PATH_CELL);
      const gz = Math.floor(z / PATH_CELL);
      const k = key(gx, gy, gz);

      let cell = cellOf.get(k);
      if (cell === undefined) {
        cell = count.length;
        cellOf.set(k, cell);
        cx.push(0);
        cy.push(0);
        cz.push(0);
        count.push(0);
        coords.push(gx, gy, gz);
      }

      cx[cell]! += x;
      cy[cell]! += y;
      cz[cell]! += z;
      count[cell]! += 1;
      cells[i] = cell;

      const dx = x - origin.x;
      const dy = y - origin.y;
      const dz = z - origin.z;
      const d = dx * dx + dy * dy + dz * dz;

      if (mesh.seed && d < seedDistance) {
        seedDistance = d;
        seedCell = cell;
      }
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = cell;
      }
    }

    vertexCells.push(cells);
    if (seedCell >= 0) seeds.set(seedCell, Math.sqrt(seedDistance));
  }

  const cells = count.length;
  const dist = new Float64Array(cells).fill(Infinity);
  if (cells === 0) return vertexCells.map((c) => new Float32Array(c.length));

  for (let c = 0; c < cells; c++) {
    cx[c]! /= count[c]!;
    cy[c]! /= count[c]!;
    cz[c]! /= count[c]!;
  }
  if (seeds.size === 0 && nearest >= 0) seeds.set(nearest, Math.sqrt(nearestDistance));

  const heap = new MinHeap(dist);
  const settled = new Uint8Array(cells);
  const between = (a: number, b: number) =>
    Math.hypot(cx[a]! - cx[b]!, cy[a]! - cy[b]!, cz[a]! - cz[b]!);

  const BUCKET = BRIDGE_REACH;
  const buckets = new Map<number, number[]>();
  const bucketKey = (c: number) =>
    key(Math.floor(cx[c]! / BUCKET), Math.floor(cy[c]! / BUCKET), Math.floor(cz[c]! / BUCKET));

  const run = () => {
    while (heap.size > 0) {
      const c = heap.pop();
      if (settled[c]) continue;
      settled[c] = 1;

      const b = bucketKey(c);
      const list = buckets.get(b);
      if (list) list.push(c);
      else buckets.set(b, [c]);

      const gx = coords[c * 3]!;
      const gy = coords[c * 3 + 1]!;
      const gz = coords[c * 3 + 2]!;

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            if (ox === 0 && oy === 0 && oz === 0) continue;
            const n = cellOf.get(key(gx + ox, gy + oy, gz + oz));
            if (n === undefined || settled[n]) continue;
            const d = dist[c]! + between(c, n);
            if (d < dist[n]!) {
              dist[n] = d;
              heap.push(n);
            }
          }
        }
      }
    }
  };

  for (const [cell, d] of seeds) {
    if (d < dist[cell]!) {
      dist[cell] = d;
      heap.push(cell);
    }
  }
  run();

  const unreached: number[] = [];
  for (let c = 0; c < cells; c++) if (!settled[c]) unreached.push(c);
  const fromOrigin = (c: number) =>
    Math.hypot(cx[c]! - origin.x, cy[c]! - origin.y, cz[c]! - origin.z);
  unreached.sort((a, b) => fromOrigin(a) - fromOrigin(b));

  for (const c of unreached) {
    if (settled[c]) continue;
    const bx = Math.floor(cx[c]! / BUCKET);
    const by = Math.floor(cy[c]! / BUCKET);
    const bz = Math.floor(cz[c]! / BUCKET);
    let best = Infinity;

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          for (const r of buckets.get(key(bx + ox, by + oy, bz + oz)) ?? []) {
            const gap = between(c, r);
            if (gap <= BRIDGE_REACH && dist[r]! + gap < best) {
              best = dist[r]! + gap;
            }
          }
        }
      }
    }

    if (best < Infinity) {
      dist[c] = best;
      heap.push(c);
      run();
      continue;
    }

    const stack = [c];
    settled[c] = 2;
    while (stack.length > 0) {
      const at = stack.pop()!;
      const gx = coords[at * 3]!;
      const gy = coords[at * 3 + 1]!;
      const gz = coords[at * 3 + 2]!;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const n = cellOf.get(key(gx + ox, gy + oy, gz + oz));
            if (n === undefined || settled[n]) continue;
            settled[n] = 2;
            stack.push(n);
          }
        }
      }
    }
  }

  return vertexCells.map((vertexCell) => {
    const out = new Float32Array(vertexCell.length);
    for (let i = 0; i < vertexCell.length; i++) {
      const d = dist[vertexCell[i]!]!;
      out[i] = Number.isFinite(d) ? d + 1 : 0;
    }
    return out;
  });
}

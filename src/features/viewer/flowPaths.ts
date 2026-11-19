import type * as THREE from "three";
import type { Vertices } from "./heartbeat";

export const PATH_CELL = 0.005;
export const BRIDGE_REACH = 0.12;

export interface PathMesh {
  vertices: Vertices;
  matrixWorld: THREE.Matrix4;
  seed: boolean;
}

const GRID_DIMENSION = 2048;
const GRID_OFFSET = GRID_DIMENSION >> 1;

function encodeGridKey(ix: number, iy: number, iz: number): number {
  return (
    (ix + GRID_OFFSET) +
    (iy + GRID_OFFSET) * GRID_DIMENSION +
    (iz + GRID_OFFSET) * GRID_DIMENSION * GRID_DIMENSION
  );
}

class PriorityIndexQueue {
  private readonly heapArray: number[] = [];

  constructor(private readonly distanceTable: Float64Array) {}

  public get length(): number {
    return this.heapArray.length;
  }

  public enqueue(index: number): void {
    const list = this.heapArray;
    list.push(index);
    let curr = list.length - 1;

    while (curr > 0) {
      const parent = (curr - 1) >> 1;
      if (this.distanceTable[list[parent]!]! <= this.distanceTable[index]!) {
        break;
      }
      list[curr] = list[parent]!;
      curr = parent;
    }
    list[curr] = index;
  }

  public dequeue(): number {
    const list = this.heapArray;
    const root = list[0]!;
    const tail = list.pop()!;

    if (list.length > 0) {
      let curr = 0;
      const count = list.length;

      while (true) {
        const left = (curr << 1) + 1;
        if (left >= count) break;
        const right = left + 1;
        const bestChild =
          right < count && this.distanceTable[list[right]!]! < this.distanceTable[list[left]!]!
            ? right
            : left;

        if (this.distanceTable[list[bestChild]!]! >= this.distanceTable[tail]!) {
          break;
        }
        list[curr] = list[bestChild]!;
        curr = bestChild;
      }
      list[curr] = tail;
    }

    return root;
  }
}

export function flowPaths(
  targetMeshes: readonly PathMesh[],
  focalOrigin: THREE.Vector3
): Float32Array[] {
  const voxelKeyToCell = new Map<number, number>();
  const accumX: number[] = [];
  const accumY: number[] = [];
  const accumZ: number[] = [];
  const vertexDensity: number[] = [];
  const voxelCoords: number[] = [];
  const meshVertexCellMap: Int32Array[] = [];
  const designatedSeeds = new Map<number, number>();

  let closestGlobalCell = -1;
  let closestGlobalDistSq = Infinity;

  for (let mIdx = 0; mIdx < targetMeshes.length; mIdx++) {
    const mesh = targetMeshes[mIdx]!;
    const mat = mesh.matrixWorld.elements;
    const vSet = mesh.vertices;
    const cellIndices = new Int32Array(vSet.count);

    let meshSeedCell = -1;
    let meshSeedDistSq = Infinity;

    for (let vIdx = 0; vIdx < vSet.count; vIdx++) {
      const lx = vSet.getX(vIdx);
      const ly = vSet.getY(vIdx);
      const lz = vSet.getZ(vIdx);

      const wx = mat[0]! * lx + mat[4]! * ly + mat[8]! * lz + mat[12]!;
      const wy = mat[1]! * lx + mat[5]! * ly + mat[9]! * lz + mat[13]!;
      const wz = mat[2]! * lx + mat[6]! * ly + mat[10]! * lz + mat[14]!;

      const gx = Math.floor(wx / PATH_CELL);
      const gy = Math.floor(wy / PATH_CELL);
      const gz = Math.floor(wz / PATH_CELL);
      const cellKey = encodeGridKey(gx, gy, gz);

      let cellId = voxelKeyToCell.get(cellKey);
      if (cellId === undefined) {
        cellId = vertexDensity.length;
        voxelKeyToCell.set(cellKey, cellId);
        accumX.push(0);
        accumY.push(0);
        accumZ.push(0);
        vertexDensity.push(0);
        voxelCoords.push(gx, gy, gz);
      }

      accumX[cellId]! += wx;
      accumY[cellId]! += wy;
      accumZ[cellId]! += wz;
      vertexDensity[cellId]! += 1;
      cellIndices[vIdx] = cellId;

      const deltaX = wx - focalOrigin.x;
      const deltaY = wy - focalOrigin.y;
      const deltaZ = wz - focalOrigin.z;
      const distSq = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;

      if (mesh.seed && distSq < meshSeedDistSq) {
        meshSeedDistSq = distSq;
        meshSeedCell = cellId;
      }

      if (distSq < closestGlobalDistSq) {
        closestGlobalDistSq = distSq;
        closestGlobalCell = cellId;
      }
    }

    meshVertexCellMap.push(cellIndices);
    if (meshSeedCell >= 0) {
      designatedSeeds.set(meshSeedCell, Math.sqrt(meshSeedDistSq));
    }
  }

  const totalCells = vertexDensity.length;
  const distanceResults = new Float64Array(totalCells).fill(Infinity);
  if (totalCells === 0) {
    return meshVertexCellMap.map((arr) => new Float32Array(arr.length));
  }

  for (let c = 0; c < totalCells; c++) {
    const weight = vertexDensity[c]!;
    accumX[c]! /= weight;
    accumY[c]! /= weight;
    accumZ[c]! /= weight;
  }

  if (designatedSeeds.size === 0 && closestGlobalCell >= 0) {
    designatedSeeds.set(closestGlobalCell, Math.sqrt(closestGlobalDistSq));
  }

  const priorityQueue = new PriorityIndexQueue(distanceResults);
  const visitedFlags = new Uint8Array(totalCells);

  const measureDistance = (c1: number, c2: number): number => {
    return Math.hypot(
      accumX[c1]! - accumX[c2]!,
      accumY[c1]! - accumY[c2]!,
      accumZ[c1]! - accumZ[c2]!
    );
  };

  const macroBlockSize = BRIDGE_REACH;
  const spatialBuckets = new Map<number, number[]>();
  const getBucketId = (cid: number): number => {
    const bx = Math.floor(accumX[cid]! / macroBlockSize);
    const by = Math.floor(accumY[cid]! / macroBlockSize);
    const bz = Math.floor(accumZ[cid]! / macroBlockSize);
    return encodeGridKey(bx, by, bz);
  };

  const propagateWavefront = () => {
    while (priorityQueue.length > 0) {
      const activeCell = priorityQueue.dequeue();
      if (visitedFlags[activeCell]) continue;
      visitedFlags[activeCell] = 1;

      const bid = getBucketId(activeCell);
      const bucketMembers = spatialBuckets.get(bid);
      if (bucketMembers) {
        bucketMembers.push(activeCell);
      } else {
        spatialBuckets.set(bid, [activeCell]);
      }

      const gx = voxelCoords[activeCell * 3]!;
      const gy = voxelCoords[activeCell * 3 + 1]!;
      const gz = voxelCoords[activeCell * 3 + 2]!;

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            if (ox === 0 && oy === 0 && oz === 0) continue;
            const neighborKey = encodeGridKey(gx + ox, gy + oy, gz + oz);
            const neighborCell = voxelKeyToCell.get(neighborKey);
            if (neighborCell === undefined || visitedFlags[neighborCell]) continue;

            const travelCost = distanceResults[activeCell]! + measureDistance(activeCell, neighborCell);
            if (travelCost < distanceResults[neighborCell]!) {
              distanceResults[neighborCell] = travelCost;
              priorityQueue.enqueue(neighborCell);
            }
          }
        }
      }
    }
  };

  for (const [seedId, seedCost] of designatedSeeds) {
    if (seedCost < distanceResults[seedId]!) {
      distanceResults[seedId] = seedCost;
      priorityQueue.enqueue(seedId);
    }
  }

  propagateWavefront();

  const disconnectedCells: number[] = [];
  for (let c = 0; c < totalCells; c++) {
    if (!visitedFlags[c]) {
      disconnectedCells.push(c);
    }
  }

  disconnectedCells.sort((a, b) => {
    const d1 = Math.hypot(accumX[a]! - focalOrigin.x, accumY[a]! - focalOrigin.y, accumZ[a]! - focalOrigin.z);
    const d2 = Math.hypot(accumX[b]! - focalOrigin.x, accumY[b]! - focalOrigin.y, accumZ[b]! - focalOrigin.z);
    return d1 - d2;
  });

  for (const unvisited of disconnectedCells) {
    if (visitedFlags[unvisited]) continue;

    const bx = Math.floor(accumX[unvisited]! / macroBlockSize);
    const by = Math.floor(accumY[unvisited]! / macroBlockSize);
    const bz = Math.floor(accumZ[unvisited]! / macroBlockSize);
    let shortestBridge = Infinity;

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          const adjBucket = spatialBuckets.get(encodeGridKey(bx + ox, by + oy, bz + oz));
          if (!adjBucket) continue;

          for (let bIdx = 0; bIdx < adjBucket.length; bIdx++) {
            const reachable = adjBucket[bIdx]!;
            const gap = measureDistance(unvisited, reachable);
            if (gap <= BRIDGE_REACH) {
              const candidateDist = distanceResults[reachable]! + gap;
              if (candidateDist < shortestBridge) {
                shortestBridge = candidateDist;
              }
            }
          }
        }
      }
    }

    if (shortestBridge < Infinity) {
      distanceResults[unvisited] = shortestBridge;
      priorityQueue.enqueue(unvisited);
      propagateWavefront();
      continue;
    }

    // Island flood fill marking as unreachable
    const islandQueue = [unvisited];
    visitedFlags[unvisited] = 2;

    while (islandQueue.length > 0) {
      const top = islandQueue.pop()!;
      const gx = voxelCoords[top * 3]!;
      const gy = voxelCoords[top * 3 + 1]!;
      const gz = voxelCoords[top * 3 + 2]!;

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const adjKey = encodeGridKey(gx + ox, gy + oy, gz + oz);
            const adjCell = voxelKeyToCell.get(adjKey);
            if (adjCell !== undefined && !visitedFlags[adjCell]) {
              visitedFlags[adjCell] = 2;
              islandQueue.push(adjCell);
            }
          }
        }
      }
    }
  }

  return meshVertexCellMap.map((vertexIndices) => {
    const finalBuffer = new Float32Array(vertexIndices.length);
    for (let i = 0; i < vertexIndices.length; i++) {
      const dist = distanceResults[vertexIndices[i]!]!;
      finalBuffer[i] = Number.isFinite(dist) ? dist + 1 : 0;
    }
    return finalBuffer;
  });
}

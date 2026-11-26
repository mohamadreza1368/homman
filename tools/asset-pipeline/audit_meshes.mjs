#!/usr/bin/env node
/**
 * HOOMAAN Asset Pipeline - GLB Mesh Topology & Manifold Auditor
 *
 * Uses @gltf-transform/core + draco3dgltf to inspect all male GLB files for:
 * - Non-manifold edges (edges shared by > 2 triangles)
 * - Open boundary edges (non-watertight holes, edges shared by 1 triangle)
 * - Degenerate triangles (repeated indices)
 * - Polygon density distribution
 */

import { readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ANATOMY_DIR = join(SCRIPT_DIR, "..", "..", "public", "anatomy");
const REPORT_PATH = join(ANATOMY_DIR, "mesh-quality-report.json");

function analyzePrimitive(prim) {
  const posAcc = prim.getAttribute("POSITION");
  const idxAcc = prim.getIndices();
  if (!posAcc) return null;

  const vertexCount = posAcc.getCount();
  const indices = idxAcc ? idxAcc.getArray() : null;
  const triCount = indices ? Math.floor(indices.length / 3) : Math.floor(vertexCount / 3);

  const edgeCounts = new Map();
  let degenerateTris = 0;

  for (let t = 0; t < triCount; t++) {
    const a = indices ? indices[t * 3] : t * 3;
    const b = indices ? indices[t * 3 + 1] : t * 3 + 1;
    const c = indices ? indices[t * 3 + 2] : t * 3 + 2;

    if (a === b || b === c || a === c) {
      degenerateTris++;
      continue;
    }

    const pairs = [
      a < b ? `${a}_${b}` : `${b}_${a}`,
      b < c ? `${b}_${c}` : `${c}_${b}`,
      a < c ? `${a}_${c}` : `${c}_${a}`,
    ];
    for (const key of pairs) {
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }

  return {
    vertices: vertexCount,
    triangles: triCount,
    boundaryEdges,
    nonManifoldEdges,
    degenerateTris,
    watertight: boundaryEdges === 0 && nonManifoldEdges === 0,
  };
}

async function main() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });

  const glbFiles = readdirSync(ANATOMY_DIR)
    .filter((f) => f.endsWith("_male.glb"))
    .sort();

  const summary = {
    generatedAt: new Date().toISOString(),
    filesScanned: glbFiles.length,
    totalMeshes: 0,
    totalTriangles: 0,
    watertightMeshes: 0,
    meshesWithBoundaryHoles: 0,
    meshesWithNonManifoldEdges: 0,
    files: {},
  };

  for (const file of glbFiles) {
    const doc = await io.read(join(ANATOMY_DIR, file));
    const meshes = doc.getRoot().listMeshes();
    let fileTris = 0;
    let fileWatertight = 0;
    let fileBoundary = 0;
    let fileNonManifold = 0;
    const maxTriMesh = { name: "", triangles: 0 };

    for (const mesh of meshes) {
      const name = mesh.getName() || "unnamed";
      let meshTris = 0;
      let meshBoundary = 0;
      let meshNonManifold = 0;

      for (const prim of mesh.listPrimitives()) {
        const stats = analyzePrimitive(prim);
        if (!stats) continue;
        meshTris += stats.triangles;
        meshBoundary += stats.boundaryEdges;
        meshNonManifold += stats.nonManifoldEdges;
      }

      summary.totalMeshes++;
      summary.totalTriangles += meshTris;
      fileTris += meshTris;

      if (meshBoundary === 0 && meshNonManifold === 0) {
        summary.watertightMeshes++;
        fileWatertight++;
      }
      if (meshBoundary > 0) {
        summary.meshesWithBoundaryHoles++;
        fileBoundary++;
      }
      if (meshNonManifold > 0) {
        summary.meshesWithNonManifoldEdges++;
        fileNonManifold++;
      }
      if (meshTris > maxTriMesh.triangles) {
        maxTriMesh.name = name;
        maxTriMesh.triangles = meshTris;
      }
    }

    summary.files[file] = {
      meshCount: meshes.length,
      totalTriangles: fileTris,
      watertightMeshes: fileWatertight,
      meshesWithBoundaryHoles: fileBoundary,
      meshesWithNonManifoldEdges: fileNonManifold,
      densestMesh: maxTriMesh,
    };
  }

  writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2), "utf8");
  console.log(
    `[HOOMAAN Mesh Audit] Scanned ${summary.filesScanned} GLBs (${summary.totalMeshes} meshes, ${summary.totalTriangles.toLocaleString()} triangles). Watertight: ${summary.watertightMeshes}, Boundary holes: ${summary.meshesWithBoundaryHoles}, Non-manifold: ${summary.meshesWithNonManifoldEdges}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

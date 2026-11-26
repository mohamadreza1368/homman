#!/usr/bin/env node
/**
 * HOOMAAN Asset Pipeline - BodyParts3D Missing Organ Extractor
 *
 * Extracts real scanned 3D STL meshes from vendor_refs/BodyParts3D/assets/BodyParts3D_data/stl/
 * for structures missing in Z-Anatomy:
 * - FMA7208: Ileum
 * - FMA14544: Rectum
 * - FMA19387: Right seminal vesicle
 * - FMA19388: Left seminal vesicle
 *
 * Applies the canonical BodyParts3D -> HOOMAAN Rx(-90°) + millimeter-to-meter alignment,
 * welds vertices, computes smooth vertex normals, and exports Draco-compressed
 * public/anatomy/bp3d_missing_male.glb.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, "..", "..");
const STL_DIR = join(PROJECT_ROOT, "vendor_refs", "BodyParts3D", "assets", "BodyParts3D_data", "stl");
const OUT_GLB = join(PROJECT_ROOT, "public", "anatomy", "bp3d_missing_male.glb");

const TARGETS = [
  { fma: "FMA7208", nodeName: "Ileum", organId: "ileum" },
  { fma: "FMA14544", nodeName: "Rectum", organId: "rectum" },
  { fma: "FMA19387", nodeName: "Right seminal vesicle", organId: "right_seminal_vesicle" },
  { fma: "FMA19388", nodeName: "Left seminal vesicle", organId: "left_seminal_vesicle" },
];

// Canonical BodyParts3D (mm, Z-up, -Y anterior) -> HOOMAAN (m, Y-up, +Z anterior)
// Proper rotation det = +1: X_h = X_bp * 0.001, Y_h = Z_bp * 0.001 + 0.032, Z_h = -Y_bp * 0.001 - 0.093
const SCALE = 0.001;
const DY = 0.032;
const DZ = -0.093;

function transformPoint(x, y, z) {
  return [x * SCALE, z * SCALE + DY, -y * SCALE + DZ];
}

function transformNormal(nx, ny, nz) {
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, nz / len, -ny / len];
}

function parseBinaryStl(filePath) {
  const buf = readFileSync(filePath);
  const triCount = buf.readUInt32LE(80);
  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);

  for (let t = 0; t < triCount; t++) {
    const off = 84 + t * 50;
    const [nx, ny, nz] = transformNormal(
      buf.readFloatLE(off),
      buf.readFloatLE(off + 4),
      buf.readFloatLE(off + 8),
    );
    for (let v = 0; v < 3; v++) {
      const vo = off + 12 + v * 12;
      const [px, py, pz] = transformPoint(
        buf.readFloatLE(vo),
        buf.readFloatLE(vo + 4),
        buf.readFloatLE(vo + 8),
      );
      const outIdx = (t * 3 + v) * 3;
      positions[outIdx] = px;
      positions[outIdx + 1] = py;
      positions[outIdx + 2] = pz;
      normals[outIdx] = nx;
      normals[outIdx + 1] = ny;
      normals[outIdx + 2] = nz;
    }
  }
  return { positions, normals, triCount };
}

async function main() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("BodyParts3D_Missing");

  for (const item of TARGETS) {
    const stlPath = join(STL_DIR, `${item.fma}.stl`);
    const { positions, normals, triCount } = parseBinaryStl(stlPath);

    const posAcc = doc.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer);
    const normAcc = doc.createAccessor().setType("VEC3").setArray(normals).setBuffer(buffer);

    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", posAcc)
      .setAttribute("NORMAL", normAcc);

    const mesh = doc.createMesh(item.nodeName).addPrimitive(prim);
    const node = doc.createNode(item.nodeName).setMesh(mesh);
    scene.addChild(node);
    console.log(`  + ${item.nodeName} (${item.fma}): ${triCount} triangles`);
  }

  await doc.transform(weld());
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });

  await io.write(OUT_GLB, doc);
  console.log(`[BodyParts3D] Exported ${TARGETS.length} real anatomical meshes -> ${OUT_GLB}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: HRA Female Geometry Extraction & Draco Optimization Engine
 *
 * Clean-room implementation designed from specs/asset-pipeline-hra-extraction.md.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { cloneDocument, dedup, draco, flatten, prune } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

import {
  SOURCE,
  STRUCTURES,
  SYSTEM_OF,
} from "./hra-selection.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, "..", "..");
const ASSET_OUTPUT_DIR = join(PROJECT_ROOT, "public", "anatomy");
const FEMALE_REPORTS_DIR = join(SCRIPT_DIR, "vendor", "reports-female");
const DEFAULT_SOURCE_MODEL = join(SCRIPT_DIR, "vendor", "hra", "3d-vh-f-united.glb");

const PINNED_SHA256 = "472567a56896b9b7890508da6501fbf858e56aaa30745365f7a71ade782b529c";

/**
 * Extraction and optimization pipeline for partitioning the NIH Human Reference Atlas
 * into segregated, Draco-compressed 3D geometry packages.
 */
export class FemaleGeometryExtractor {
  static PINNED_HASH = PINNED_SHA256;

  /**
   * Constructs a standardized clinical display title.
   * @param {{ term: string, english?: string, qualifier?: string, side?: "left" | "right" | null }} entry
   * @returns {string}
   */
  static formatClinicalName(entry) {
    const rootName = entry.english || entry.term;
    const baseWithQualifier = entry.qualifier ? `${rootName}, ${entry.qualifier}` : rootName;

    if (entry.side === "left") return `${baseWithQualifier} (left)`;
    if (entry.side === "right") return `${baseWithQualifier} (right)`;
    return baseWithQualifier;
  }

  /**
   * Calculates total primitive polygon count for a glTF mesh.
   * @param {object} mesh
   * @returns {number}
   */
  static countMeshTriangles(mesh) {
    if (!mesh || typeof mesh.listPrimitives !== "function") return 0;
    let totalTriangles = 0;

    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      const vertCount = idx ? idx.getCount() : (pos ? pos.getCount() : 0);
      totalTriangles += Math.trunc(vertCount / 3);
    }

    return totalTriangles;
  }

  constructor(cliArgs = process.argv.slice(2)) {
    this.options = this.parseArguments(cliArgs);
  }

  parseArguments(args) {
    const config = {
      inputFile: DEFAULT_SOURCE_MODEL,
      downloadMissing: false,
      bypassHashCheck: false,
      systemFilter: null,
    };

    for (const arg of args) {
      if (arg === "--fetch" || arg === "--download") {
        config.downloadMissing = true;
      } else if (arg === "--allow-unpinned") {
        config.bypassHashCheck = true;
      } else if (arg.startsWith("--system=")) {
        config.systemFilter = arg.slice("--system=".length);
      } else if (arg.startsWith("--input=")) {
        config.inputFile = arg.slice("--input=".length);
      } else if (!arg.startsWith("--")) {
        config.inputFile = arg;
      }
    }

    return config;
  }

  verifyChecksum(filePath) {
    const buffer = readFileSync(filePath);
    const computed = createHash("sha256").update(buffer).digest("hex");

    if (computed !== FemaleGeometryExtractor.PINNED_HASH && !this.options.bypassHashCheck) {
      throw new Error(
        `SHA-256 integrity verification failed for ${filePath}.\nExpected: ${FemaleGeometryExtractor.PINNED_HASH}\nComputed: ${computed}\nPass --allow-unpinned to override.`,
      );
    }
  }

  async execute() {
    if (!existsSync(this.options.inputFile)) {
      if (this.options.downloadMissing) {
        console.log(`Model file not found at ${this.options.inputFile}. Downloading from ${SOURCE.url}...`);
        mkdirSync(dirname(this.options.inputFile), { recursive: true });
        const res = await fetch(SOURCE.url);
        if (!res.ok) throw new Error(`HTTP fetch failed with code ${res.status}: ${res.statusText}`);
        const data = await res.arrayBuffer();
        writeFileSync(this.options.inputFile, Buffer.from(data));
      } else {
        throw new Error(
          `Master HRA 3D model not found at ${this.options.inputFile}.\nRun with --download or place 3d-vh-f-united.glb in tools/asset-pipeline/vendor/hra/.`,
        );
      }
    }

    this.verifyChecksum(this.options.inputFile);

    mkdirSync(ASSET_OUTPUT_DIR, { recursive: true });
    mkdirSync(FEMALE_REPORTS_DIR, { recursive: true });

    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const dracoEncoder = await draco3d.createEncoderModule();
    const dracoDecoder = await draco3d.createDecoderModule();
    io.registerDependencies({
      "draco3d.encoder": dracoEncoder,
      "draco3d.decoder": dracoDecoder,
    });

    console.log(`Reading master geometry: ${this.options.inputFile}...`);
    const masterDoc = await io.read(this.options.inputFile);

    // Group structures by system
    const systemMap = new Map();
    for (const struct of STRUCTURES) {
      const assignedSys = SYSTEM_OF.get(struct.node);
      if (!assignedSys) continue;
      if (this.options.systemFilter && this.options.systemFilter !== assignedSys) continue;

      if (!systemMap.has(assignedSys)) systemMap.set(assignedSys, []);
      systemMap.get(assignedSys).push(struct);
    }

    const availableNodes = new Map();
    for (const node of masterDoc.getRoot().listNodes()) {
      availableNodes.set(node.getName(), node);
    }

    for (const [sysName, structList] of systemMap.entries()) {
      console.log(`Extracting ${sysName} (${structList.length} structures)...`);
      const sysDoc = cloneDocument(masterDoc);

      const keepNodes = new Set(structList.map((s) => s.node));
      for (const node of sysDoc.getRoot().listNodes()) {
        if (!keepNodes.has(node.getName())) {
          node.dispose();
        }
      }

      await sysDoc.transform(
        prune(),
        dedup(),
        flatten(),
        draco({ compressionLevel: 7 }),
      );

      const glbFileName = `female_${sysName}.glb`;
      const outGlb = join(ASSET_OUTPUT_DIR, glbFileName);
      await io.write(outGlb, sysDoc);

      const inspectionObjects = [];
      for (const s of structList) {
        const found = availableNodes.get(s.node);
        const mesh = found?.getMesh();
        const tris = mesh ? FemaleGeometryExtractor.countMeshTriangles(mesh) : 0;

        inspectionObjects.push({
          name: FemaleGeometryExtractor.formatClinicalName(s),
          node: s.node,
          organ_id: s.id,
          term: s.term,
          ...(s.qualifier ? { qualifier: s.qualifier } : {}),
          triangles: tris,
          path: s.path,
        });
      }

      const reportPayload = {
        sex: "female",
        system: sysName,
        output: glbFileName,
        objects: inspectionObjects,
      };

      const outReport = join(FEMALE_REPORTS_DIR, `${sysName}.json`);
      writeFileSync(outReport, JSON.stringify(reportPayload, null, 2), "utf8");
      console.log(`  Saved ${outGlb} and ${outReport}`);
    }

    console.log("HRA female extraction completed successfully.");
  }
}

// Auto-run when executed directly via CLI
if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  new FemaleGeometryExtractor().execute().catch((err) => {
    console.error("Extraction error:", err);
    process.exit(1);
  });
}

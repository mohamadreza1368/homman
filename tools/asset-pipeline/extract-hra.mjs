#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Human Reference Atlas (HRA) Geometry Partitioning & Draco Optimization Engine.
 *
 * Clean-room implementation designed from specs/asset-pipeline-hra-extraction.md.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_WORKSPACE = join(CURRENT_DIR, "..", "..");
const OUTPUT_ASSETS_DIR = join(ROOT_WORKSPACE, "public", "anatomy");
const FEMALE_REPORTS_DIR = join(CURRENT_DIR, "vendor", "reports-female");
const DEFAULT_MASTER_MODEL = join(CURRENT_DIR, "vendor", "hra", "3d-vh-f-united.glb");

/**
 * Extraction and optimization pipeline for partitioning the NIH Human Reference Atlas
 * into segregated, Draco-compressed 3D geometry packages.
 */
export class FemaleGeometryExtractor {
  static PINNED_HASH = "472567a56896b9b7890508da6501fbf858e56aaa30745365f7a71ade782b529c";

  /**
   * Formats a clinical display name with qualifiers and laterality.
   * @param {{ term: string, english?: string, qualifier?: string, side?: "left" | "right" | null }} entry
   * @returns {string}
   */
  static formatClinicalName(entry) {
    const baseName = entry.english || entry.term;
    const qualified = entry.qualifier ? `${baseName}, ${entry.qualifier}` : baseName;

    if (entry.side === "left") return `${qualified} (left)`;
    if (entry.side === "right") return `${qualified} (right)`;
    return qualified;
  }

  /**
   * Calculates total primitive polygon count for a glTF mesh.
   * @param {object} mesh
   * @returns {number}
   */
  static countMeshTriangles(mesh) {
    let triangles = 0;
    for (const primitive of mesh.listPrimitives()) {
      const indexAccessor = primitive.getIndices();
      const positionAccessor = primitive.getAttribute("POSITION");
      const vertices = indexAccessor ? indexAccessor.getCount() : (positionAccessor?.getCount() ?? 0);
      triangles += Math.trunc(vertices / 3);
    }
    return triangles;
  }

  constructor(cliArgs = process.argv.slice(2)) {
    this.options = this.parseCliOptions(cliArgs);
  }

  parseCliOptions(args) {
    const options = {
      sourceGlbPath: DEFAULT_MASTER_MODEL,
      downloadIfMissing: false,
      allowUnpinnedHash: false,
      targetSystem: null,
    };

    for (const arg of args) {
      if (arg === "--fetch" || arg === "--download") {
        options.downloadIfMissing = true;
      } else if (arg === "--allow-unpinned") {
        options.allowUnpinnedHash = true;
      } else if (arg.startsWith("--system=")) {
        options.targetSystem = arg.slice("--system=".length);
      } else if (arg.startsWith("--input=")) {
        options.sourceGlbPath = arg.slice("--input=".length);
      } else if (!arg.startsWith("--")) {
        options.sourceGlbPath = arg;
      }
    }

    return options;
  }

  verifyChecksum(filePath, expectedSha256) {
    const fileBuffer = readFileSync(filePath);
    const computedHash = createHash("sha256").update(fileBuffer).digest("hex");

    if (computedHash !== expectedSha256) {
      if (!this.options.allowUnpinnedHash) {
        throw new Error(
          `HRA source SHA-256 verification failed.\nExpected: ${expectedSha256}\nComputed: ${computedHash}\nPass --allow-unpinned to override.`,
        );
      }
      process.stderr.write(`Warning: SHA-256 mismatch overridden: ${computedHash}\n`);
    }

    return computedHash;
  }

  async acquireMasterModel(remoteUrl, localDestination) {
    process.stderr.write(`Downloading master HRA model from: ${remoteUrl}\n`);
    mkdirSync(dirname(localDestination), { recursive: true });

    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`HTTP transfer failed (${response.status} ${response.statusText}) for ${remoteUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    writeFileSync(localDestination, Buffer.from(arrayBuffer));
    process.stderr.write(`Saved master model to: ${localDestination} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)\n`);
  }

  async execute() {
    let sourcePath = this.options.sourceGlbPath;

    if (!existsSync(sourcePath)) {
      if (this.options.downloadIfMissing) {
        await this.acquireMasterModel(SOURCE.url, sourcePath);
      } else {
        throw new Error(
          `Master HRA source file not found at: ${sourcePath}.\nRun with --fetch to automatically download official assets.`,
        );
      }
    }

    const verifiedSha = this.verifyChecksum(sourcePath, FemaleGeometryExtractor.PINNED_HASH);
    mkdirSync(FEMALE_REPORTS_DIR, { recursive: true });
    mkdirSync(OUTPUT_ASSETS_DIR, { recursive: true });

    process.stderr.write(`Initializing glTF transform pipeline for: ${sourcePath}\n`);

    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({
        "draco3d.decoder": await draco3d.createDecoderModule(),
        "draco3d.encoder": await draco3d.createEncoderModule(),
      });

    const masterDoc = await io.read(sourcePath);
    const rootNodes = masterDoc.getRoot().listNodes();

    const nodeIndex = new Map();
    for (const node of rootNodes) {
      nodeIndex.set(node.getName(), node);
    }

    const systemsToExtract = new Map();
    for (const item of STRUCTURES) {
      const assignedSystem = SYSTEM_OF.get(item.node);
      if (!assignedSystem) {
        throw new Error(`Organ structure '${item.node}' lacks system mapping.`);
      }

      if (this.options.targetSystem && assignedSystem !== this.options.targetSystem) {
        continue;
      }

      if (!systemsToExtract.has(assignedSystem)) {
        systemsToExtract.set(assignedSystem, []);
      }
      systemsToExtract.get(assignedSystem).push(item);
    }

    const extractionSummaries = [];

    for (const [systemName, organList] of systemsToExtract.entries()) {
      process.stderr.write(`Extracting system package: ${systemName} (${organList.length} structures)\n`);

      const systemDoc = cloneDocument(masterDoc);
      const systemRoot = systemDoc.getRoot();
      const retainedNames = new Set(organList.map((entry) => entry.node));

      for (const node of systemRoot.listNodes()) {
        if (!retainedNames.has(node.getName())) {
          node.dispose();
        }
      }

      // Optimization pipeline
      await systemDoc.transform(
        flatten(),
        dedup(),
        prune({ keepAttributes: false, keepLeaves: false }),
        draco({
          method: "edgebreaker",
          encodeSpeed: 5,
          decodeSpeed: 5,
          quantizePosition: 14,
        }),
      );

      const targetFileName = `female_${systemName}.glb`;
      const targetFilePath = join(OUTPUT_ASSETS_DIR, targetFileName);

      const binaryPayload = await io.writeBinary(systemDoc);
      writeFileSync(targetFilePath, binaryPayload);

      const fileSizeBytes = statSync(targetFilePath).size;
      const inspectedItems = [];

      for (const entry of organList) {
        const liveNode = systemRoot.listNodes().find((n) => n.getName() === entry.node);
        const mesh = liveNode ? liveNode.getMesh() : null;
        const triCount = mesh ? FemaleGeometryExtractor.countMeshTriangles(mesh) : 0;

        inspectedItems.push({
          node: entry.node,
          organ_id: entry.id,
          name: FemaleGeometryExtractor.formatClinicalName(entry),
          term: entry.term,
          ...(entry.qualifier ? { qualifier: entry.qualifier } : {}),
          side: entry.side,
          path: entry.path,
          polygons: triCount,
        });
      }

      const totalSystemPolygons = inspectedItems.reduce((acc, item) => acc + item.polygons, 0);

      const reportPath = join(FEMALE_REPORTS_DIR, `${systemName}.json`);
      const reportContent = {
        system: systemName,
        sex: "female",
        source: { ...SOURCE, sha256: verifiedSha },
        output: targetFileName,
        draco: true,
        object_count: inspectedItems.length,
        objects: inspectedItems.sort((a, b) => a.name.localeCompare(b.name)),
      };

      writeFileSync(reportPath, `${JSON.stringify(reportContent, null, 1)}\n`, "utf8");
      extractionSummaries.push({
        system: systemName,
        count: inspectedItems.length,
        triangles: totalSystemPolygons,
        bytes: fileSizeBytes,
      });

      process.stderr.write(
        `  ${targetFileName.padEnd(28)} ${String(inspectedItems.length).padStart(3)} structures  ${totalSystemPolygons.toLocaleString().padStart(9)} tris  ${(fileSizeBytes / 1024).toFixed(0)} KB\n`,
      );
    }

    const grandTotal = extractionSummaries.reduce(
      (acc, s) => ({ count: acc.count + s.count, bytes: acc.bytes + s.bytes }),
      { count: 0, bytes: 0 },
    );

    process.stderr.write(
      `\nCompleted: ${grandTotal.count} structures, ${(grandTotal.bytes / (1024 * 1024)).toFixed(2)} MB across ${extractionSummaries.length} systems.\n`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  new FemaleGeometryExtractor().execute().catch((err) => {
    process.stderr.write(`Fatal error during HRA extraction: ${err.message}\n`);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Human Reference Atlas (HRA) 3D Anatomy Extraction and Draco Optimization Engine.
 * Parses the NIH Visible Human Female master glTF scene into system-segregated packages.
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
const PROJECT_ROOT = join(CURRENT_DIR, "..", "..");
const ANATOMY_ASSETS_DIR = join(PROJECT_ROOT, "public", "anatomy");
const FEMALE_REPORTS_DIR = join(CURRENT_DIR, "vendor", "reports-female");
const DEFAULT_SOURCE_FILE = join(CURRENT_DIR, "vendor", "hra", "3d-vh-f-united.glb");

/**
 * Orchestrator for glTF scene decimation, material neutralization, Draco compression,
 * and provenance report generation for the Human Reference Atlas.
 */
export class HraModelExtractor {
  static PINNED_HASH = "472567a56896b9b7890508da6501fbf858e56aaa30745365f7a71ade782b529c";

  static formatClinicalName(entry) {
    const base = entry.english || entry.term;
    const qualified = entry.qualifier ? `${base}, ${entry.qualifier}` : base;

    if (entry.side === "left") return `${qualified} (left)`;
    if (entry.side === "right") return `${qualified} (right)`;
    return qualified;
  }

  static tallyTriangles(mesh) {
    let triangleCount = 0;
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const positions = primitive.getAttribute("POSITION");
      const vertexTotal = indices ? indices.getCount() : (positions?.getCount() ?? 0);
      triangleCount += Math.trunc(vertexTotal / 3);
    }
    return triangleCount;
  }

  constructor(cliArgs = process.argv.slice(2)) {
    this.options = this.parseArguments(cliArgs);
  }

  parseArguments(tokens) {
    const params = {
      source: DEFAULT_SOURCE_FILE,
      fetchRemote: false,
      allowUnpinned: false,
    };

    let i = 0;
    while (i < tokens.length) {
      const arg = tokens[i];
      if (arg === "--help" || arg === "-h") {
        console.log("Usage: node extract-hra.mjs [--source <path>] [--fetch] [--allow-unpinned]");
        process.exit(0);
      } else if (arg === "--source") {
        params.source = tokens[++i];
      } else if (arg === "--fetch") {
        params.fetchRemote = true;
      } else if (arg === "--allow-unpinned") {
        params.allowUnpinned = true;
      } else {
        throw new Error(`Unrecognized CLI flag: ${arg}`);
      }
      i++;
    }

    return params;
  }

  async acquireSourceModel() {
    const { source, fetchRemote } = this.options;
    if (existsSync(source)) return source;

    if (!fetchRemote) {
      throw new Error(
        `Source model absent at ${source}. Supply --fetch to download from ${SOURCE.url} or specify --source.`,
      );
    }

    mkdirSync(dirname(source), { recursive: true });
    process.stderr.write(`Acquiring HRA dataset from ${SOURCE.url}...\n`);
    const response = await fetch(SOURCE.url);
    if (!response.ok) {
      throw new Error(`Download failed with HTTP status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    writeFileSync(source, Buffer.from(arrayBuffer));
    return source;
  }

  validateIntegrity(filePath) {
    const computedSha = createHash("sha256").update(readFileSync(filePath)).digest("hex");
    if (computedSha === HraModelExtractor.PINNED_HASH) return computedSha;

    const discrepancy = `HRA glTF source checksum diverged from pinned version (${HraModelExtractor.PINNED_HASH} vs ${computedSha})`;
    if (!this.options.allowUnpinned) throw new Error(discrepancy);
    process.stderr.write(`Warning: ${discrepancy}\n`);
    return computedSha;
  }

  async initializeIoEngine() {
    return new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({
        "draco3d.encoder": await draco3d.createEncoderModule(),
        "draco3d.decoder": await draco3d.createDecoderModule(),
      });
  }

  groupStructuresBySystem() {
    const systemMap = new Map();
    for (const struct of STRUCTURES) {
      const sys = SYSTEM_OF.get(struct.node);
      if (!systemMap.has(sys)) systemMap.set(sys, []);
      systemMap.get(sys).push(struct);
    }
    return systemMap;
  }

  async execute() {
    const sourcePath = await this.acquireSourceModel();
    const verifiedChecksum = this.validateIntegrity(sourcePath);
    const io = await this.initializeIoEngine();

    const systemGroups = this.groupStructuresBySystem();
    const targetNodeSet = new Set(STRUCTURES.map((s) => s.node));

    process.stderr.write(`Parsing master GLTF: ${sourcePath}...\n`);
    const masterSceneDoc = await io.read(sourcePath);

    const sceneNodeNames = new Set(masterSceneDoc.getRoot().listNodes().map((n) => n.getName()));
    const missingNodes = [...targetNodeSet].filter((id) => !sceneNodeNames.has(id));

    if (missingNodes.length > 0) {
      throw new Error(`Master dataset missing target nodes: ${missingNodes.join(", ")}`);
    }

    mkdirSync(FEMALE_REPORTS_DIR, { recursive: true });
    const runSummaries = [];

    const sortedSystems = Array.from(systemGroups.entries()).sort(([a], [b]) => a.localeCompare(b));

    for (const [systemKey, structures] of sortedSystems) {
      const sceneSystemDoc = cloneDocument(masterSceneDoc);
      const activeIds = new Set(structures.map((s) => s.node));

      await sceneSystemDoc.transform(flatten());

      for (const node of sceneSystemDoc.getRoot().listNodes()) {
        if (!activeIds.has(node.getName())) {
          node.dispose();
        }
      }

      // Neutralize materials and remove superfluous texture/color coordinates
      for (const mesh of sceneSystemDoc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          prim.setMaterial(null);
          for (const attr of prim.listSemantics()) {
            if (attr.startsWith("TEXCOORD_") || attr.startsWith("COLOR_")) {
              prim.setAttribute(attr, null);
            }
          }
        }
      }

      const inspectedItems = [];
      const nodeIndex = new Map(sceneSystemDoc.getRoot().listNodes().map((n) => [n.getName(), n]));

      for (const item of structures) {
        const liveNode = nodeIndex.get(item.node);
        const liveMesh = liveNode?.getMesh();
        if (!liveMesh) {
          throw new Error(`Flattened mesh missing for node: ${item.node}`);
        }

        inspectedItems.push({
          name: HraModelExtractor.formatClinicalName(item),
          organ_id: item.id,
          node: item.node,
          term: item.term,
          qualifier: item.qualifier ?? null,
          side: item.side,
          ontology_id: liveNode.getExtras()?.ontologyid ?? null,
          source_label: liveNode.getExtras()?.label ?? null,
          polygons: HraModelExtractor.tallyTriangles(liveMesh),
          path: item.path,
        });
      }

      // Optimize geometry with Draco compression
      await sceneSystemDoc.transform(
        prune({ keepAttributes: false }),
        dedup(),
        draco({
          method: "edgebreaker",
          encodeSpeed: 4,
          decodeSpeed: 5,
          quantizePosition: 14,
          quantizeNormal: 10,
        }),
      );

      const glbName = `${systemKey}_female.glb`;
      const glbDestination = join(ANATOMY_ASSETS_DIR, glbName);
      await io.write(glbDestination, sceneSystemDoc);

      const byteSize = statSync(glbDestination).size;
      const systemFaces = inspectedItems.reduce((acc, obj) => acc + obj.polygons, 0);

      const reportDestination = join(FEMALE_REPORTS_DIR, `${systemKey}.json`);
      const reportPayload = {
        system: systemKey,
        sex: "female",
        source: { ...SOURCE, sha256: verifiedChecksum },
        output: glbName,
        draco: true,
        object_count: inspectedItems.length,
        objects: inspectedItems.sort((a, b) => a.name.localeCompare(b.name)),
      };

      writeFileSync(reportDestination, `${JSON.stringify(reportPayload, null, 1)}\n`, "utf8");
      runSummaries.push({ systemKey, count: inspectedItems.length, totalFaces: systemFaces, bytes: byteSize });

      process.stderr.write(
        `  ${glbName.padEnd(28)} ${String(inspectedItems.length).padStart(3)} structures  ${systemFaces.toLocaleString().padStart(9)} tris  ${(byteSize / 1024).toFixed(0)} KB\n`,
      );
    }

    const totalStats = runSummaries.reduce(
      (acc, s) => ({ count: acc.count + s.count, bytes: acc.bytes + s.bytes }),
      { count: 0, bytes: 0 },
    );

    process.stderr.write(
      `\nCompleted: ${totalStats.count} structures, ${(totalStats.bytes / (1024 * 1024)).toFixed(2)} MB across ${runSummaries.length} systems.\n`,
    );
  }
}

export const displayName = HraModelExtractor.formatClinicalName;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  new HraModelExtractor().execute().catch((err) => {
    process.stderr.write(`Fatal error during HRA extraction: ${err.message}\n`);
    process.exit(1);
  });
}

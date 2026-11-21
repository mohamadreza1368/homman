#!/usr/bin/env node
/**
 * HOOMAAN Asset Pipeline - HRA Female 3D Anatomy Extractor
 * Extracts pelvic and abdominal organs from the Human Reference Atlas (HRA) master glTF model,
 * optimizing meshes using Draco compression and generating provenance reports per anatomical system.
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
  KNOWN_SOURCE_ERRATA,
  NOT_IN_TA2,
  OUT_OF_SCOPE,
  SOURCE,
  STRUCTURES,
  SYSTEM_OF,
} from "./hra-selection.mjs";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(CURRENT_DIR, "..", "..");
const ANATOMY_DIR = join(ROOT_DIR, "public", "anatomy");
const REPORTS_FEMALE_DIR = join(CURRENT_DIR, "vendor", "reports-female");
const LOCAL_SOURCE_PATH = join(CURRENT_DIR, "vendor", "hra", "3d-vh-f-united.glb");

const PINNED_SOURCE_HASH = "472567a56896b9b7890508da6501fbf858e56aaa30745365f7a71ade782b529c";

/**
 * Generates user-facing clinical nomenclature label with laterality and optional anatomical qualifier.
 * @param {{ english?: string, term: string, qualifier?: string | null, side?: string | null }} entry
 * @returns {string}
 */
export function displayName(entry) {
  const rootLabel = entry.english || entry.term;
  const withQualifier = entry.qualifier ? `${rootLabel}, ${entry.qualifier}` : rootLabel;

  if (entry.side === "left") return `${withQualifier} (left)`;
  if (entry.side === "right") return `${withQualifier} (right)`;
  return withQualifier;
}

function computeMeshFaces(mesh) {
  let triangles = 0;
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    const pos = prim.getAttribute("POSITION");
    const count = idx ? idx.getCount() : (pos?.getCount() ?? 0);
    triangles += Math.trunc(count / 3);
  }
  return triangles;
}

function parseCommandLineOptions(tokens) {
  const cfg = {
    source: LOCAL_SOURCE_PATH,
    fetch: false,
    allowUnpinned: false,
  };

  for (let idx = 0; idx < tokens.length; idx++) {
    const flag = tokens[idx];
    if (flag === "--source") {
      cfg.source = tokens[++idx];
    } else if (flag === "--fetch") {
      cfg.fetch = true;
    } else if (flag === "--allow-unpinned") {
      cfg.allowUnpinned = true;
    } else {
      throw new Error(`Unrecognized CLI flag: ${flag}`);
    }
  }

  return cfg;
}

async function prepareSourceBinary(targetPath, allowDownload) {
  if (existsSync(targetPath)) return targetPath;

  if (!allowDownload) {
    throw new Error(
      `Source model absent at ${targetPath}. Supply --fetch to download from ${SOURCE.url} or specify --source.`,
    );
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  process.stderr.write(`Acquiring HRA dataset from ${SOURCE.url}...\n`);
  const resp = await fetch(SOURCE.url);
  if (!resp.ok) {
    throw new Error(`Download failed with HTTP status ${resp.status}`);
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  writeFileSync(targetPath, buf);
  return targetPath;
}

function verifyDigest(filePath, bypassMismatch) {
  const sha = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  if (sha === PINNED_SOURCE_HASH) return sha;

  const errMsg = `HRA glTF source checksum diverged from pinned version (${PINNED_SOURCE_HASH} vs ${sha})`;
  if (!bypassMismatch) throw new Error(errMsg);
  process.stderr.write(`Warning: ${errMsg}\n`);
  return sha;
}

async function runExtractionPipeline() {
  const options = parseCommandLineOptions(process.argv.slice(2));
  const sourceGlbPath = await prepareSourceBinary(options.source, options.fetch);
  const validatedHash = verifyDigest(sourceGlbPath, options.allowUnpinned);

  const ioPipeline = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.encoder": await draco3d.createEncoderModule(),
      "draco3d.decoder": await draco3d.createDecoderModule(),
    });

  const structureIndex = new Map(STRUCTURES.map((s) => [s.node, s]));
  const groupedSystems = new Map();

  for (const s of STRUCTURES) {
    const sysName = SYSTEM_OF.get(s.node);
    if (!groupedSystems.has(sysName)) groupedSystems.set(sysName, []);
    groupedSystems.get(sysName).push(s);
  }

  process.stderr.write(`Parsing master GLTF: ${sourceGlbPath}...\n`);
  const masterDoc = await ioPipeline.read(sourceGlbPath);

  const availableNodes = new Set(masterDoc.getRoot().listNodes().map((n) => n.getName()));
  const missingNodes = [...structureIndex.keys()].filter((name) => !availableNodes.has(name));

  if (missingNodes.length > 0) {
    throw new Error(`Master dataset missing target nodes: ${missingNodes.join(", ")}`);
  }

  mkdirSync(REPORTS_FEMALE_DIR, { recursive: true });
  const logEntries = [];

  for (const [systemKey, organItems] of Array.from(groupedSystems.entries()).sort()) {
    const docCopy = cloneDocument(masterDoc);
    const validNodeSet = new Set(organItems.map((o) => o.node));

    await docCopy.transform(flatten());

    for (const node of docCopy.getRoot().listNodes()) {
      if (!validNodeSet.has(node.getName())) {
        node.dispose();
      }
    }

    for (const mesh of docCopy.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        prim.setMaterial(null);
        for (const sem of prim.listSemantics()) {
          if (sem.startsWith("TEXCOORD_") || sem.startsWith("COLOR_")) {
            prim.setAttribute(sem, null);
          }
        }
      }
    }

    const reportObjects = [];
    const nodeMap = new Map(docCopy.getRoot().listNodes().map((n) => [n.getName(), n]));

    for (const item of organItems) {
      const activeNode = nodeMap.get(item.node);
      const meshElem = activeNode?.getMesh();
      if (!meshElem) {
        throw new Error(`Flattened mesh missing for node: ${item.node}`);
      }

      reportObjects.push({
        name: displayName(item),
        organ_id: item.id,
        node: item.node,
        term: item.term,
        qualifier: item.qualifier ?? null,
        side: item.side,
        ontology_id: activeNode.getExtras()?.ontologyid ?? null,
        source_label: activeNode.getExtras()?.label ?? null,
        polygons: computeMeshFaces(meshElem),
        path: item.path,
      });
    }

    await docCopy.transform(
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

    const glbFilename = `${systemKey}_female.glb`;
    const targetFile = join(ANATOMY_DIR, glbFilename);
    await ioPipeline.write(targetFile, docCopy);

    const fileSizeBytes = statSync(targetFile).size;
    const totalTris = reportObjects.reduce((acc, o) => acc + o.polygons, 0);

    const reportFile = join(REPORTS_FEMALE_DIR, `${systemKey}.json`);
    const reportData = {
      system: systemKey,
      sex: "female",
      source: { ...SOURCE, sha256: validatedHash },
      output: glbFilename,
      draco: true,
      object_count: reportObjects.length,
      objects: reportObjects.sort((a, b) => a.name.localeCompare(b.name)),
    };

    writeFileSync(reportFile, `${JSON.stringify(reportData, null, 1)}\n`, "utf8");
    logEntries.push({ systemKey, count: reportObjects.length, totalTris, fileSizeBytes });

    process.stderr.write(
      `  ${glbFilename.padEnd(28)} ${String(reportObjects.length).padStart(3)} structures  ${totalTris.toLocaleString().padStart(9)} tris  ${(fileSizeBytes / 1024).toFixed(0)} KB\n`,
    );
  }

  const sumTotal = logEntries.reduce(
    (acc, e) => ({ count: acc.count + e.count, bytes: acc.bytes + e.fileSizeBytes }),
    { count: 0, bytes: 0 },
  );

  process.stderr.write(
    `\nCompleted: ${sumTotal.count} structures, ${(sumTotal.bytes / (1024 * 1024)).toFixed(2)} MB across ${logEntries.length} systems.\n`,
  );
}

runExtractionPipeline().catch((err) => {
  process.stderr.write(`Fatal error during HRA extraction: ${err.message}\n`);
  process.exit(1);
});

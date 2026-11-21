#!/usr/bin/env node
/**
 * HOOMAAN Asset Pipeline - Primary Manifest Compiler (Male / Z-Anatomy)
 * Compiles Blender export inspection reports into public/anatomy/manifest.json,
 * joining 3D mesh nodes with Terminologia Anatomica 2 Latin nomenclature.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { repairHierarchy } from "./hierarchy.mjs";
import { parseTa2, slugify } from "./ta2.mjs";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(CURRENT_DIR, "..", "..");
const TA2_PATH = join(CURRENT_DIR, "vendor", "TA2.csv");
const REPORTS_DIR = join(CURRENT_DIR, "vendor", "reports");
const OUTPUT_FILE = join(ROOT_DIR, "public", "anatomy", "manifest.json");

const METADATA_ATTRIBUTION =
  "Meshes adapted from Z-Anatomy (CC BY-SA 4.0), itself derived from BodyParts3D / DBCLS (CC BY-SA 2.1 JP). See NOTICE.";
const METADATA_CREDIT = "Z-Anatomy / BodyParts3D (DBCLS)";

const DEFAULT_EAGER_SYSTEMS = new Set(["skeletal"]);

const PREFERRED_SYSTEM_ORDER = [
  "skeletal",
  "articular",
  "muscular",
  "nervous",
  "cardiovascular",
  "respiratory",
  "digestive",
  "renal",
  "endocrine",
  "reproductive",
  "lymphatic",
  "visceral",
  "regional",
];

const ANATOMICAL_ROUTERS = [
  {
    system: "respiratory",
    matcher: /lung|bronch|trache|pleur|larynx|laryng|alveol|pulmonar|nasal|nasopharynx|oropharynx|pharyn|sinus/i,
  },
  {
    system: "renal",
    matcher: /kidney|renal|ureter|bladder|urethra|nephr/i,
  },
  {
    system: "endocrine",
    matcher: /thyroid|parathyroid|suprarenal|adrenal|pituitar|hypophys|pineal|thymus/i,
  },
  {
    system: "reproductive",
    matcher: /uter|ovar|testis|testicul|prostat|penis|vagin|scrot|epididym|seminal|vas deferens/i,
  },
  {
    system: "digestive",
    matcher: /stomach|gastr|liver|hepat|pancrea|intestin|duoden|jejun|ile|colon|caec|cec|rect|anal|oesophag|esophag|gallbladder|bile|biliar|tongue|lingual|palat|tooth|teeth|salivary|parotid|submandib|sublingual|peritone|omentum|mesenter|appendi/i,
  },
];

function resolveVisceralTarget(englishTerm) {
  const match = ANATOMICAL_ROUTERS.find((r) => r.matcher.test(englishTerm));
  return match ? match.system : null;
}

const TRAILING_SUFFIX_REGEX = /\.(l|r|el|er|ol|or|i|j|t|s|g|st)$/i;

function dissectNodeName(nodeLabel) {
  let workingName = nodeLabel.trim();
  let detectedLaterality = null;

  while (true) {
    const matchedSuffix = TRAILING_SUFFIX_REGEX.exec(workingName);
    if (!matchedSuffix) break;

    const token = matchedSuffix[1].toLowerCase();
    if (!detectedLaterality) {
      const sideChar = token.length > 1 ? token.slice(-1) : token;
      if (sideChar === "l" && token !== "st") {
        detectedLaterality = "left";
      } else if (sideChar === "r") {
        detectedLaterality = "right";
      }
    }
    workingName = workingName.slice(0, matchedSuffix.index);
  }

  workingName = workingName.trim().replace(/\.+$/, "").trim();
  const parenMatch = /^\((.*)\)$/.exec(workingName);
  if (parenMatch) {
    workingName = parenMatch[1].trim();
  }

  return {
    cleanName: workingName.replace(/\.+$/, "").trim(),
    laterality: detectedLaterality,
  };
}

function retrieveExportReports() {
  if (!existsSync(REPORTS_DIR)) {
    throw new Error(`Export report directory not found: ${REPORTS_DIR}`);
  }

  const jsonReports = readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((filename) => JSON.parse(readFileSync(join(REPORTS_DIR, filename), "utf8")));

  return jsonReports.sort((a, b) => {
    const idxA = PREFERRED_SYSTEM_ORDER.indexOf(a.system);
    const idxB = PREFERRED_SYSTEM_ORDER.indexOf(b.system);
    const rankA = idxA === -1 ? PREFERRED_SYSTEM_ORDER.length : idxA;
    const rankB = idxB === -1 ? PREFERRED_SYSTEM_ORDER.length : idxB;
    return rankA - rankB;
  });
}

function executePipeline() {
  const dictionary = parseTa2(readFileSync(TA2_PATH, "utf8"));
  const reportList = retrieveExportReports();

  const compiledOrgans = [];
  const registeredIdentifiers = new Map();
  const unassignedVisceral = [];
  const missingNomenclature = [];
  let sharedMeshCount = 0;

  for (const report of reportList) {
    if (!report.system) {
      throw new Error(`Missing anatomical system in report: ${report.output}`);
    }

    const meshFileName = basename(report.output);

    for (const objectDef of report.objects) {
      const { cleanName, laterality } = dissectNodeName(objectDef.name);
      const vocabularyItem = dictionary.get(cleanName.toLowerCase());

      if (!vocabularyItem) {
        missingNomenclature.push(objectDef.name);
        continue;
      }

      const generatedId = slugify(objectDef.name);
      const existingRegistration = registeredIdentifiers.get(generatedId);

      if (existingRegistration !== undefined) {
        if (existingRegistration === objectDef.name) {
          sharedMeshCount++;
          continue;
        }
        throw new Error(
          `Identifier collision detected on '${generatedId}': '${existingRegistration}' vs '${objectDef.name}'`,
        );
      }
      registeredIdentifiers.set(generatedId, objectDef.name);

      let targetSystem = report.system;
      if (targetSystem === "visceral") {
        const remapped = resolveVisceralTarget(vocabularyItem.en);
        if (!remapped) {
          unassignedVisceral.push(vocabularyItem.en);
          continue;
        }
        targetSystem = remapped;
      }

      const lateralitySuffix =
        laterality === "left" ? " (left)" : laterality === "right" ? " (right)" : "";

      compiledOrgans.push({
        organ_id: generatedId,
        ta2_latin: vocabularyItem.la || vocabularyItem.en,
        name_en: `${vocabularyItem.en}${lateralitySuffix}`,
        system: targetSystem,
        mesh_file: meshFileName,
        node: objectDef.name,
        path: Array.isArray(objectDef.path) ? objectDef.path : [],
      });
    }
  }

  if (compiledOrgans.length === 0) {
    throw new Error("Pipeline produced zero matched anatomical structures.");
  }

  const systemFrequencies = new Map();
  for (const organ of compiledOrgans) {
    systemFrequencies.set(organ.system, (systemFrequencies.get(organ.system) || 0) + 1);
  }

  const manifestSystems = Array.from(systemFrequencies.entries())
    .map(([sysKey, count]) => ({
      system: sysKey,
      organ_count: count,
      load_on_start: DEFAULT_EAGER_SYSTEMS.has(sysKey),
    }))
    .sort((a, b) => a.system.localeCompare(b.system));

  if (!manifestSystems.some((s) => s.load_on_start)) {
    manifestSystems[0].load_on_start = true;
  }

  const { organs: finalizedOrgans, corrected, propagated } = repairHierarchy(compiledOrgans);
  finalizedOrgans.sort((a, b) => a.ta2_latin.localeCompare(b.ta2_latin));

  const payload = {
    version: 1,
    gender_model: "male",
    attribution: METADATA_ATTRIBUTION,
    credit: METADATA_CREDIT,
    license: "CC-BY-SA-4.0",
    systems: manifestSystems,
    organs: finalizedOrgans,
  };

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${OUTPUT_FILE}`);
  console.log(`  ${finalizedOrgans.length} structures total`);
  console.log(`  hierarchy: ${corrected} refiled by name, ${propagated} propagated from a twin`);
  for (const entry of manifestSystems) {
    console.log(`  ${entry.system}: ${entry.organ_count} (${entry.load_on_start ? "eager" : "on demand"})`);
  }
  if (unassignedVisceral.length > 0) {
    const unrec = [...new Set(unassignedVisceral)];
    console.log(`  ${unrec.length} unrouted visceral items.`);
  }
  if (sharedMeshCount > 0) {
    console.log(`  ${sharedMeshCount} structure(s) shared across systems, listed once`);
  }
  if (missingNomenclature.length > 0) {
    console.log(`  ${missingNomenclature.length} skipped (no TA2 match)`);
  }
}

executePipeline();

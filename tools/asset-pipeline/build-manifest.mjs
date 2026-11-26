#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Male Atlas Manifest Compiler
 *
 * Clean-room implementation designed from specs/asset-pipeline-manifest-builder.md.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { TaxonomyTreeHarmonizer } from "./hierarchy.mjs";
import { TextNormalizer, TerminologyAtlas } from "./ta2.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, "..", "..");
const TA2_FILE = join(SCRIPT_DIR, "vendor", "TA2.csv");
const REPORTS_DIR = join(SCRIPT_DIR, "vendor", "reports");
const OUTPUT_FILE = join(PROJECT_ROOT, "public", "anatomy", "manifest.json");

const METADATA_ATTRIBUTION =
  "Meshes adapted from Z-Anatomy (CC BY-SA 4.0), itself derived from BodyParts3D / DBCLS (CC BY-SA 2.1 JP). See NOTICE.";
const METADATA_CREDIT = "Z-Anatomy / BodyParts3D (DBCLS)";
const METADATA_LICENSE = "CC-BY-SA-4.0";

const SYSTEM_ORDER = Object.freeze([
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
]);

const EAGER_LOAD_SYSTEMS = Object.freeze(new Set(["skeletal"]));

const VISCERAL_ROUTING_RULES = Object.freeze([
  {
    targetSystem: "digestive",
    matcher: /stomach|gastr|liver|hepat|pancrea|intestin|duoden|jejun|ile|colon|caec|cec|rect|anal|oesophag|esophag|gallbladder|bile|biliar|tongue|lingual|palat|tooth|teeth|salivary|parotid|submandib|sublingual|peritone|omentum|mesenter|appendi/i,
  },
  {
    targetSystem: "respiratory",
    matcher: /lung|bronch|trache|pleur|larynx|laryng|alveol|pulmonar|nasal|nasopharynx|oropharynx|pharyn|sinus/i,
  },
  {
    targetSystem: "renal",
    matcher: /kidney|renal|ureter|(?<!gall)bladder|urethra|nephr/i,
  },
  {
    targetSystem: "endocrine",
    matcher: /thyroid|parathyroid|suprarenal|adrenal|pituitar|hypophys|pineal|thymus/i,
  },
  {
    targetSystem: "reproductive",
    matcher: /uter|ovar|testis|testicul|prostat|penis|vagin|scrot|epididym|seminal|vas deferens/i,
  },
]);

/**
 * Compiler for the Canonical Male Anatomical Atlas Manifest.
 */
export class MaleAtlasManifestGenerator {
  static ATTRIBUTION = METADATA_ATTRIBUTION;
  static CREDIT = METADATA_CREDIT;
  static LICENSE = METADATA_LICENSE;
  static SYSTEM_LOAD_PRECEDENCE = SYSTEM_ORDER;
  static INITIAL_ACTIVE_SYSTEMS = EAGER_LOAD_SYSTEMS;
  static VISCERAL_ROUTING_PATTERNS = VISCERAL_ROUTING_RULES.map((r) => ({
    target: r.targetSystem,
    regex: r.matcher,
  }));

  /**
   * Deconstructs a Blender node name, stripping trailing markers and identifying laterality.
   * @param {string} rawIdentifier
   * @returns {{ cleanName: string, laterality: "left" | "right" | null }}
   */
  static parseNodeIdentifier(rawIdentifier) {
    let clean = (rawIdentifier || "").trim();
    let side = null;

    const trailingTokenRegex = /\.(l|r|el|er|ol|or|i|j|t|s|g|st)$/i;

    while (true) {
      clean = clean.replace(/^\((.*)\)$/, "$1").trim();
      const match = trailingTokenRegex.exec(clean);
      if (!match) break;

      const suffix = match[1].toLowerCase();
      if (!side) {
        const lastChar = suffix.length > 1 ? suffix.slice(-1) : suffix;
        if (lastChar === "l" && suffix !== "st") side = "left";
        else if (lastChar === "r") side = "right";
      }
      clean = clean.slice(0, match.index).trim();
    }

    clean = clean.replace(/^\((.*)\)$/, "$1").trim().replace(/\.+$/, "").trim();

    return {
      cleanName: clean,
      laterality: side,
    };
  }

  /**
   * Categorizes a visceral anatomical structure into a primary physiological system.
   * @param {string} englishTerm
   * @returns {string | null}
   */
  static classifyVisceralOrgan(englishTerm) {
    if (!englishTerm) return null;
    for (const rule of VISCERAL_ROUTING_RULES) {
      if (rule.matcher.test(englishTerm)) {
        return rule.targetSystem;
      }
    }
    return null;
  }

  loadInspectionReports() {
    if (!existsSync(REPORTS_DIR)) {
      throw new Error(`Inspection reports directory not found: ${REPORTS_DIR}`);
    }

    const files = readdirSync(REPORTS_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort();

    const loaded = files.map((fileName) => {
      const fullPath = join(REPORTS_DIR, fileName);
      return JSON.parse(readFileSync(fullPath, "utf8"));
    });

    return loaded.sort((a, b) => {
      const idxA = SYSTEM_ORDER.indexOf(a.system);
      const idxB = SYSTEM_ORDER.indexOf(b.system);
      const rankA = idxA === -1 ? SYSTEM_ORDER.length : idxA;
      const rankB = idxB === -1 ? SYSTEM_ORDER.length : idxB;
      return rankA - rankB;
    });
  }

  compile() {
    const terminologyService = new TerminologyAtlas();
    const vocabulary = terminologyService.parseCsv(readFileSync(TA2_FILE, "utf8"));
    const reports = this.loadInspectionReports();

    const harmonizer = new TaxonomyTreeHarmonizer();
    const collectedOrgans = [];
    const registeredIds = new Map();
    const systemCounts = new Map();
    let skippedUnmatched = 0;
    let sharedAcrossSystems = 0;

    for (const report of reports) {
      const meshName = basename(report.output);

      for (const obj of report.objects) {
        const parsedNode = MaleAtlasManifestGenerator.parseNodeIdentifier(obj.name);
        const vocabRecord = vocabulary.get(parsedNode.cleanName.toLowerCase());

        if (!vocabRecord) {
          skippedUnmatched++;
          continue;
        }

        const generatedId = TextNormalizer.slugify(obj.name);
        const existingNode = registeredIds.get(generatedId);

        if (existingNode !== undefined) {
          if (existingNode === obj.name) {
            sharedAcrossSystems++;
            continue;
          }
          throw new Error(
            `Identifier collision detected on '${generatedId}': '${existingNode}' vs '${obj.name}'`,
          );
        }
        registeredIds.set(generatedId, obj.name);

        let assignedSystem = report.system;
        if (assignedSystem === "visceral") {
          const routed = MaleAtlasManifestGenerator.classifyVisceralOrgan(vocabRecord.en);
          if (!routed) {
            continue;
          }
          assignedSystem = routed;
        }

        const sideSuffix = parsedNode.laterality === "left"
          ? " (left)"
          : parsedNode.laterality === "right"
            ? " (right)"
            : "";
        const displayName = `${vocabRecord.en}${sideSuffix}`;

        collectedOrgans.push({
          organ_id: generatedId,
          ta2_latin: vocabRecord.la || vocabRecord.en,
          name_en: displayName,
          system: assignedSystem,
          mesh_file: meshName,
          node: obj.name,
          path: Array.isArray(obj.path) ? obj.path : [],
        });

        systemCounts.set(assignedSystem, (systemCounts.get(assignedSystem) || 0) + 1);
      }
    }

    // Curate tree taxonomy (nervous hierarchy, twin propagation, heading renames)
    const curationResult = harmonizer.harmonize(collectedOrgans);
    const curatedOrgans = curationResult.organs;
    curatedOrgans.sort((a, b) => a.ta2_latin.localeCompare(b.ta2_latin));

    const compiledSystems = Array.from(systemCounts.entries())
      .map(([system, count]) => ({
        system,
        organ_count: count,
        load_on_start: EAGER_LOAD_SYSTEMS.has(system),
      }))
      .sort((a, b) => {
        const orderA = SYSTEM_ORDER.indexOf(a.system);
        const orderB = SYSTEM_ORDER.indexOf(b.system);
        const rankA = orderA === -1 ? SYSTEM_ORDER.length : orderA;
        const rankB = orderB === -1 ? SYSTEM_ORDER.length : orderB;
        return rankA - rankB;
      });

    const manifestData = {
      version: 1,
      gender_model: "male",
      attribution: MaleAtlasManifestGenerator.ATTRIBUTION,
      credit: MaleAtlasManifestGenerator.CREDIT,
      license: MaleAtlasManifestGenerator.LICENSE,
      systems: compiledSystems,
      organs: curatedOrgans,
    };

    writeFileSync(OUTPUT_FILE, `${JSON.stringify(manifestData, null, 2)}\n`, "utf8");

    console.log(`Wrote ${OUTPUT_FILE}`);
    console.log(`  ${curatedOrgans.length} structures total`);
    console.log(
      `  hierarchy: ${curationResult.corrected} refiled by name, ${curationResult.propagated} propagated from a twin`,
    );
    for (const sys of compiledSystems) {
      console.log(`  ${sys.system}: ${sys.organ_count} (${sys.load_on_start ? "eager" : "on demand"})`);
    }
    if (sharedAcrossSystems > 0) {
      console.log(`  ${sharedAcrossSystems} structure(s) shared across systems, listed once`);
    }
    if (skippedUnmatched > 0) {
      console.log(`  ${skippedUnmatched} skipped (no TA2 match)`);
    }
  }
}

// Auto-run when executed directly via CLI
if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  new MaleAtlasManifestGenerator().compile();
}

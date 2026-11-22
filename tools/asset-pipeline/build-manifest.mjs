#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Male Atlas Manifest Compiler.
 *
 * Clean-room implementation designed from specs/asset-pipeline-manifest-builder.md.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { TaxonomyCurationEngine } from "./hierarchy.mjs";
import { AnatomicalTerminologyService } from "./ta2.mjs";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_WORKSPACE = join(CURRENT_DIR, "..", "..");
const TA2_CSV_PATH = join(CURRENT_DIR, "vendor", "TA2.csv");
const INSPECTION_REPORTS_DIR = join(CURRENT_DIR, "vendor", "reports");
const TARGET_MANIFEST_PATH = join(ROOT_WORKSPACE, "public", "anatomy", "manifest.json");

/**
 * Compiler that orchestrates geometry inspection logs, TA2 Latin standard terms,
 * and hierarchy curation into the canonical male anatomy manifest.
 */
export class MaleAtlasManifestGenerator {
  static ATTRIBUTION =
    "Meshes adapted from Z-Anatomy (CC BY-SA 4.0), itself derived from BodyParts3D / DBCLS (CC BY-SA 2.1 JP). See NOTICE.";
  static CREDIT = "Z-Anatomy / BodyParts3D (DBCLS)";
  static LICENSE = "CC-BY-SA-4.0";

  static SYSTEM_LOAD_PRECEDENCE = Object.freeze([
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

  static INITIAL_ACTIVE_SYSTEMS = Object.freeze(new Set(["skeletal"]));

  static VISCERAL_ROUTING_PATTERNS = Object.freeze([
    {
      target: "digestive",
      regex: /stomach|gastr|liver|hepat|pancrea|intestin|duoden|jejun|ile|colon|caec|cec|rect|anal|oesophag|esophag|gallbladder|bile|biliar|tongue|lingual|palat|tooth|teeth|salivary|parotid|submandib|sublingual|peritone|omentum|mesenter|appendi/i,
    },
    {
      target: "respiratory",
      regex: /lung|bronch|trache|pleur|larynx|laryng|alveol|pulmonar|nasal|nasopharynx|oropharynx|pharyn|sinus/i,
    },
    {
      target: "renal",
      regex: /kidney|renal|ureter|(?<!gall)bladder|urethra|nephr/i,
    },
    {
      target: "endocrine",
      regex: /thyroid|parathyroid|suprarenal|adrenal|pituitar|hypophys|pineal|thymus/i,
    },
    {
      target: "reproductive",
      regex: /uter|ovar|testis|testicul|prostat|penis|vagin|scrot|epididym|seminal|vas deferens/i,
    },
  ]);

  /**
   * Normalizes raw Blender node names, extracting lateral symmetry.
   * @param {string} rawIdentifier
   * @returns {{ cleanName: string, laterality: "left" | "right" | null }}
   */
  static parseNodeIdentifier(rawIdentifier) {
    let label = rawIdentifier.trim();
    let detectedSide = null;

    const trailingTokenPattern = /\.(l|r|el|er|ol|or|i|j|t|s|g|st)$/i;
    while (true) {
      label = label.replace(/^\((.*)\)$/, "$1").trim();
      const match = trailingTokenPattern.exec(label);
      if (!match) break;
      const token = match[1].toLowerCase();
      if (!detectedSide) {
        const lastLetter = token.length > 1 ? token.slice(-1) : token;
        if (lastLetter === "l" && token !== "st") detectedSide = "left";
        else if (lastLetter === "r") detectedSide = "right";
      }
      label = label.slice(0, match.index).trim();
    }

    label = label.replace(/^\((.*)\)$/, "$1").trim().replace(/\.+$/, "").trim();

    return {
      cleanName: label,
      laterality: detectedSide,
    };
  }

  /**
   * Determines targeted physiological system for visceral organ elements.
   * @param {string} englishTerm
   * @returns {string | null}
   */
  static classifyVisceralOrgan(englishTerm) {
    for (const rule of MaleAtlasManifestGenerator.VISCERAL_ROUTING_PATTERNS) {
      if (rule.regex.test(englishTerm)) {
        return rule.target;
      }
    }
    return null;
  }

  compile() {
    const terminologyService = new AnatomicalTerminologyService();
    const terminology = terminologyService.parseCsvRecords(readFileSync(TA2_CSV_PATH, "utf8"));
    const reportCollection = this.loadInspectionReports();

    const compiledOrgans = [];
    const organIdRegistry = new Map();
    const systemFrequencies = new Map();
    let sharedMeshInstances = 0;
    let unmatchedCount = 0;

    for (const report of reportCollection) {
      const meshFileName = basename(report.output);

      for (const obj of report.objects) {
        const parsed = MaleAtlasManifestGenerator.parseNodeIdentifier(obj.name);
        const termData = terminology.get(parsed.cleanName.toLowerCase());

        if (!termData) {
          unmatchedCount++;
          continue;
        }

        const organId = AnatomicalTerminologyService.createSlug(obj.name);
        const existingNode = organIdRegistry.get(organId);

        if (existingNode !== undefined) {
          if (existingNode === obj.name) {
            sharedMeshInstances++;
            continue;
          }
          throw new Error(
            `Identifier collision detected on '${organId}': '${existingNode}' vs '${obj.name}'`,
          );
        }
        organIdRegistry.set(organId, obj.name);

        let systemAssignment = report.system;
        if (systemAssignment === "visceral") {
          const routed = MaleAtlasManifestGenerator.classifyVisceralOrgan(termData.en);
          if (!routed) {
            continue;
          }
          systemAssignment = routed;
        }

        const sideSuffix = parsed.laterality === "left" ? " (left)" : parsed.laterality === "right" ? " (right)" : "";
        const englishLabel = `${termData.en}${sideSuffix}`;
        const latinLabel = termData.la || termData.en;

        const organRecord = {
          organ_id: organId,
          ta2_latin: latinLabel,
          name_en: englishLabel,
          system: systemAssignment,
          mesh_file: meshFileName,
          node: obj.name,
          path: Array.isArray(obj.path) ? obj.path : [],
        };

        compiledOrgans.push(organRecord);

        systemFrequencies.set(
          systemAssignment,
          (systemFrequencies.get(systemAssignment) || 0) + 1,
        );
      }
    }

    const manifestSystems = Array.from(systemFrequencies.entries())
      .map(([sysName, count]) => ({
        system: sysName,
        organ_count: count,
        load_on_start: MaleAtlasManifestGenerator.INITIAL_ACTIVE_SYSTEMS.has(sysName),
      }))
      .sort((a, b) => {
        const orderA = MaleAtlasManifestGenerator.SYSTEM_LOAD_PRECEDENCE.indexOf(a.system);
        const orderB = MaleAtlasManifestGenerator.SYSTEM_LOAD_PRECEDENCE.indexOf(b.system);
        const rankA = orderA === -1 ? MaleAtlasManifestGenerator.SYSTEM_LOAD_PRECEDENCE.length : orderA;
        const rankB = orderB === -1 ? MaleAtlasManifestGenerator.SYSTEM_LOAD_PRECEDENCE.length : orderB;
        return rankA - rankB;
      });

    const curationEngine = new TaxonomyCurationEngine();
    const { organs: curatedOrgans, corrected, propagated } = curationEngine.curateOrganTaxonomy(compiledOrgans);
    curatedOrgans.sort((a, b) => a.ta2_latin.localeCompare(b.ta2_latin));

    const manifestData = {
      version: 1,
      gender_model: "male",
      attribution: MaleAtlasManifestGenerator.ATTRIBUTION,
      credit: MaleAtlasManifestGenerator.CREDIT,
      license: MaleAtlasManifestGenerator.LICENSE,
      systems: manifestSystems,
      organs: curatedOrgans,
    };

    writeFileSync(TARGET_MANIFEST_PATH, `${JSON.stringify(manifestData, null, 2)}\n`, "utf8");

    console.log(`Wrote ${TARGET_MANIFEST_PATH}`);
    console.log(`  ${curatedOrgans.length} structures total`);
    console.log(`  hierarchy: ${corrected} refiled by name, ${propagated} propagated from a twin`);
    for (const sys of manifestSystems) {
      console.log(`  ${sys.system}: ${sys.organ_count} (${sys.load_on_start ? "eager" : "on demand"})`);
    }
    if (sharedMeshInstances > 0) {
      console.log(`  ${sharedMeshInstances} structure(s) shared across systems, listed once`);
    }
    if (unmatchedCount > 0) {
      console.log(`  ${unmatchedCount} skipped (no TA2 match)`);
    }
  }

  loadInspectionReports() {
    if (!existsSync(INSPECTION_REPORTS_DIR)) {
      throw new Error(`Blender inspection reports missing at: ${INSPECTION_REPORTS_DIR}`);
    }

    const files = readdirSync(INSPECTION_REPORTS_DIR)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((fileName) => JSON.parse(readFileSync(join(INSPECTION_REPORTS_DIR, fileName), "utf8")));

    return files.sort((a, b) => {
      const idxA = MaleAtlasManifestGenerator.SYSTEM_LOAD_PRECEDENCE.indexOf(a.system);
      const idxB = MaleAtlasManifestGenerator.SYSTEM_LOAD_PRECEDENCE.indexOf(b.system);
      const rankA = idxA === -1 ? MaleAtlasManifestGenerator.SYSTEM_LOAD_PRECEDENCE.length : idxA;
      const rankB = idxB === -1 ? MaleAtlasManifestGenerator.SYSTEM_LOAD_PRECEDENCE.length : idxB;
      return rankA - rankB;
    });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  new MaleAtlasManifestGenerator().compile();
}

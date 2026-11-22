#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Male Anatomical Manifest Compiler.
 * Combines 3D geometry inspection reports with Terminologia Anatomica 2 Latin standard.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { repairHierarchy } from "./hierarchy.mjs";
import { parseTa2, slugify } from "./ta2.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(SCRIPT_DIRECTORY, "..", "..");
const TA2_DICTIONARY_PATH = join(SCRIPT_DIRECTORY, "vendor", "TA2.csv");
const EXPORT_REPORTS_DIRECTORY = join(SCRIPT_DIRECTORY, "vendor", "reports");
const MALE_MANIFEST_DESTINATION = join(WORKSPACE_ROOT, "public", "anatomy", "manifest.json");

/**
 * Builds the canonical male anatomy manifest from Blender mesh reports and TA2 nomenclature.
 */
export class MaleAnatomyManifestCompiler {
  static ATTRIBUTION_NOTICE =
    "Meshes adapted from Z-Anatomy (CC BY-SA 4.0), itself derived from BodyParts3D / DBCLS (CC BY-SA 2.1 JP). See NOTICE.";
  static ATTRIBUTION_CREDIT = "Z-Anatomy / BodyParts3D (DBCLS)";
  static LICENSE_IDENTIFIER = "CC-BY-SA-4.0";

  static ANATOMICAL_ORDER = Object.freeze([
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

  static EAGER_SYSTEMS = Object.freeze(new Set(["skeletal"]));

  static VISCERAL_MAPPING = Object.freeze([
    {
      target: "digestive",
      pattern: /stomach|gastr|liver|hepat|pancrea|intestin|duoden|jejun|ile|colon|caec|cec|rect|anal|oesophag|esophag|gallbladder|bile|biliar|tongue|lingual|palat|tooth|teeth|salivary|parotid|submandib|sublingual|peritone|omentum|mesenter|appendi/i,
    },
    {
      target: "respiratory",
      pattern: /lung|bronch|trache|pleur|larynx|laryng|alveol|pulmonar|nasal|nasopharynx|oropharynx|pharyn|sinus/i,
    },
    {
      target: "renal",
      pattern: /kidney|renal|ureter|(?<!gall)bladder|urethra|nephr/i,
    },
    {
      target: "endocrine",
      pattern: /thyroid|parathyroid|suprarenal|adrenal|pituitar|hypophys|pineal|thymus/i,
    },
    {
      target: "reproductive",
      pattern: /uter|ovar|testis|testicul|prostat|penis|vagin|scrot|epididym|seminal|vas deferens/i,
    },
  ]);

  static normalizeBlenderIdentifier(rawLabel) {
    let label = rawLabel.trim();
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

  static categorizeVisceralOrgan(englishTerm) {
    const route = this.VISCERAL_MAPPING.find((entry) => entry.pattern.test(englishTerm));
    return route ? route.target : null;
  }

  compileManifest() {
    const nomenclature = parseTa2(readFileSync(TA2_DICTIONARY_PATH, "utf8"));
    const inspectionFiles = this.loadInspectionReports();

    const assembledStructures = [];
    const registeredIds = new Map();
    const unroutedVisceral = [];
    const unmatchedTerms = [];
    let sharedMeshInstances = 0;

    for (const report of inspectionFiles) {
      if (!report.system) {
        throw new Error(`Report entry missing anatomical system attribute: ${report.output}`);
      }

      const gltfBasename = basename(report.output);

      for (const objectDef of report.objects) {
        const { cleanName, laterality } = MaleAnatomyManifestCompiler.normalizeBlenderIdentifier(objectDef.name);
        const termEntry = nomenclature.get(cleanName.toLowerCase());

        if (!termEntry) {
          unmatchedTerms.push(objectDef.name);
          continue;
        }

        const organIdentifier = slugify(objectDef.name);
        const existingNode = registeredIds.get(organIdentifier);

        if (existingNode !== undefined) {
          if (existingNode === objectDef.name) {
            sharedMeshInstances++;
            continue;
          }
          throw new Error(
            `Identifier collision detected on '${organIdentifier}': '${existingNode}' vs '${objectDef.name}'`,
          );
        }
        registeredIds.set(organIdentifier, objectDef.name);

        let finalSystem = report.system;
        if (finalSystem === "visceral") {
          const mapped = MaleAnatomyManifestCompiler.categorizeVisceralOrgan(termEntry.en);
          if (!mapped) {
            unroutedVisceral.push(termEntry.en);
            continue;
          }
          finalSystem = mapped;
        }

        const sideSuffix = laterality === "left" ? " (left)" : laterality === "right" ? " (right)" : "";

        assembledStructures.push({
          organ_id: organIdentifier,
          ta2_latin: termEntry.la || termEntry.en,
          name_en: `${termEntry.en}${sideSuffix}`,
          system: finalSystem,
          mesh_file: gltfBasename,
          node: objectDef.name,
          path: Array.isArray(objectDef.path) ? objectDef.path : [],
        });
      }
    }

    if (assembledStructures.length === 0) {
      throw new Error("Male manifest generation aborted: zero matching anatomical structures found.");
    }

    // Build system summary records
    const systemCounts = new Map();
    for (const organ of assembledStructures) {
      systemCounts.set(organ.system, (systemCounts.get(organ.system) || 0) + 1);
    }

    const systemSummary = Array.from(systemCounts.entries())
      .map(([system, organ_count]) => ({
        system,
        organ_count,
        load_on_start: MaleAnatomyManifestCompiler.EAGER_SYSTEMS.has(system),
      }))
      .sort((a, b) => a.system.localeCompare(b.system));

    if (!systemSummary.some((s) => s.load_on_start)) {
      systemSummary[0].load_on_start = true;
    }

    const { organs: curatedOrgans, corrected, propagated } = repairHierarchy(assembledStructures);
    curatedOrgans.sort((a, b) => a.ta2_latin.localeCompare(b.ta2_latin));

    const manifestOutput = {
      version: 1,
      gender_model: "male",
      attribution: MaleAnatomyManifestCompiler.ATTRIBUTION_NOTICE,
      credit: MaleAnatomyManifestCompiler.ATTRIBUTION_CREDIT,
      license: MaleAnatomyManifestCompiler.LICENSE_IDENTIFIER,
      systems: systemSummary,
      organs: curatedOrgans,
    };

    writeFileSync(MALE_MANIFEST_DESTINATION, `${JSON.stringify(manifestOutput, null, 2)}\n`, "utf8");

    console.log(`Wrote ${MALE_MANIFEST_DESTINATION}`);
    console.log(`  ${curatedOrgans.length} structures total`);
    console.log(`  hierarchy: ${corrected} refiled by name, ${propagated} propagated from a twin`);
    for (const sys of systemSummary) {
      console.log(`  ${sys.system}: ${sys.organ_count} (${sys.load_on_start ? "eager" : "on demand"})`);
    }
    if (unroutedVisceral.length > 0) {
      const uniqueUnrouted = [...new Set(unroutedVisceral)];
      console.log(`  ${uniqueUnrouted.length} unrouted visceral items.`);
    }
    if (sharedMeshInstances > 0) {
      console.log(`  ${sharedMeshInstances} structure(s) shared across systems, listed once`);
    }
    if (unmatchedTerms.length > 0) {
      console.log(`  ${unmatchedTerms.length} skipped (no TA2 match)`);
    }
  }

  loadInspectionReports() {
    if (!existsSync(EXPORT_REPORTS_DIRECTORY)) {
      throw new Error(`Blender inspection reports missing at: ${EXPORT_REPORTS_DIRECTORY}`);
    }

    const reportFiles = readdirSync(EXPORT_REPORTS_DIRECTORY)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((fileName) => JSON.parse(readFileSync(join(EXPORT_REPORTS_DIRECTORY, fileName), "utf8")));

    return reportFiles.sort((a, b) => {
      const rankA = MaleAnatomyManifestCompiler.ANATOMICAL_ORDER.indexOf(a.system);
      const rankB = MaleAnatomyManifestCompiler.ANATOMICAL_ORDER.indexOf(b.system);
      const posA = rankA === -1 ? MaleAnatomyManifestCompiler.ANATOMICAL_ORDER.length : rankA;
      const posB = rankB === -1 ? MaleAnatomyManifestCompiler.ANATOMICAL_ORDER.length : rankB;
      return posA - posB;
    });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  new MaleAnatomyManifestCompiler().compileManifest();
}

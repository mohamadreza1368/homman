#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Female Atlas Manifest Compiler
 *
 * Clean-room implementation designed from specs/asset-pipeline-manifest-builder.md.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { TerminologyAtlas } from "./ta2.mjs";
import { SOURCE } from "./hra-selection.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, "..", "..");
const TA2_FILE = join(SCRIPT_DIR, "vendor", "TA2.csv");
const FEMALE_REPORTS_DIR = join(SCRIPT_DIR, "vendor", "reports-female");
const OUTPUT_FILE = join(PROJECT_ROOT, "public", "anatomy", "manifest_female.json");

const METADATA_ATTRIBUTION =
  "Meshes from the Human Reference Atlas (HRA) 3D Reference Organ Library, HuBMAP Consortium / NIH (CC BY 4.0), derived from the Visible Human Female dataset of the U.S. National Library of Medicine. See NOTICE.";
const METADATA_CREDIT = "NIH Human Reference Atlas / Visible Human Female (NLM)";
const METADATA_LICENSE = "CC-BY-4.0";

/**
 * Compiles the female anatomical atlas manifest from HRA inspection reports.
 */
export class FemaleAtlasManifestGenerator {
  static ATTRIBUTION = METADATA_ATTRIBUTION;
  static CREDIT = METADATA_CREDIT;
  static LICENSE = METADATA_LICENSE;

  readInspectionReports() {
    if (!existsSync(FEMALE_REPORTS_DIR)) {
      throw new Error(`Female inspection reports directory missing: ${FEMALE_REPORTS_DIR}`);
    }

    const files = readdirSync(FEMALE_REPORTS_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort();

    return files.map((fileName) => {
      const fullPath = join(FEMALE_REPORTS_DIR, fileName);
      return JSON.parse(readFileSync(fullPath, "utf8"));
    });
  }

  compile() {
    const terminologyService = new TerminologyAtlas();
    const vocabulary = terminologyService.parseCsv(readFileSync(TA2_FILE, "utf8"));
    const reports = this.readInspectionReports();

    const compiledOrgans = [];
    const organRegistry = new Map();
    const systemCounts = new Map();

    for (const report of reports) {
      if (report.sex !== "female") {
        throw new Error(`Invalid non-female report found in collection: ${report.output}`);
      }

      for (const obj of report.objects) {
        const vocabRecord = vocabulary.get(obj.term.toLowerCase());
        if (!vocabRecord) {
          throw new Error(`Unresolved anatomical term '${obj.term}' (${obj.node}) in TA2 database.`);
        }

        if (organRegistry.has(obj.organ_id)) {
          const priorNode = organRegistry.get(obj.organ_id);
          throw new Error(
            `Duplicate female organ identifier: ${obj.organ_id} ('${priorNode}' vs '${obj.node}')`,
          );
        }
        organRegistry.set(obj.organ_id, obj.node);

        compiledOrgans.push({
          organ_id: obj.organ_id,
          ta2_latin: vocabRecord.la || vocabRecord.en,
          name_en: obj.name,
          ...(obj.qualifier ? { qualifier: obj.qualifier } : {}),
          system: report.system,
          mesh_file: report.output,
          node: obj.node,
          path: Array.isArray(obj.path) ? obj.path : [],
        });

        systemCounts.set(report.system, (systemCounts.get(report.system) || 0) + 1);
      }
    }

    if (compiledOrgans.length === 0) {
      throw new Error("No organs compiled for female anatomical manifest.");
    }

    const compiledSystems = Array.from(systemCounts.entries())
      .map(([system, count]) => ({
        system,
        organ_count: count,
        load_on_start: true,
      }))
      .sort((a, b) => a.system.localeCompare(b.system));

    compiledOrgans.sort((a, b) => a.ta2_latin.localeCompare(b.ta2_latin));

    const manifestData = {
      version: 1,
      gender_model: "female",
      attribution: FemaleAtlasManifestGenerator.ATTRIBUTION,
      credit: FemaleAtlasManifestGenerator.CREDIT,
      license: FemaleAtlasManifestGenerator.LICENSE,
      source: SOURCE,
      systems: compiledSystems,
      organs: compiledOrgans,
    };

    writeFileSync(OUTPUT_FILE, `${JSON.stringify(manifestData, null, 2)}\n`, "utf8");

    console.log(`Wrote ${OUTPUT_FILE}`);
    console.log(`  ${compiledOrgans.length} structures total`);
    for (const sys of compiledSystems) {
      console.log(`  ${sys.system}: ${sys.organ_count} (eager)`);
    }
  }
}

// Auto-run when executed directly via CLI
if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  new FemaleAtlasManifestGenerator().compile();
}

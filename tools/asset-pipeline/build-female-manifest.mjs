#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Female Atlas Manifest Compiler.
 *
 * Clean-room implementation designed from specs/asset-pipeline-manifest-builder.md.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AnatomicalTerminologyService } from "./ta2.mjs";
import { SOURCE } from "./hra-selection.mjs";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_WORKSPACE = join(CURRENT_DIR, "..", "..");
const TA2_PATH = join(CURRENT_DIR, "vendor", "TA2.csv");
const FEMALE_REPORTS_DIR = join(CURRENT_DIR, "vendor", "reports-female");
const TARGET_FEMALE_MANIFEST = join(ROOT_WORKSPACE, "public", "anatomy", "manifest_female.json");

/**
 * Compiles the female anatomical manifest from extracted HRA system reports.
 */
export class FemaleAtlasManifestGenerator {
  static ATTRIBUTION =
    "Meshes from the Human Reference Atlas (HRA) 3D Reference Organ Library, HuBMAP Consortium / NIH (CC BY 4.0), derived from the Visible Human Female dataset of the U.S. National Library of Medicine. See NOTICE.";
  static CREDIT = "NIH Human Reference Atlas / Visible Human Female (NLM)";
  static LICENSE = "CC-BY-4.0";

  compile() {
    const terminologyService = new AnatomicalTerminologyService();
    const terminology = terminologyService.parseCsvRecords(readFileSync(TA2_PATH, "utf8"));
    const reports = this.readInspectionReports();

    const compiledOrgans = [];
    const organIdRegistry = new Map();

    for (const report of reports) {
      if (report.sex !== "female") {
        throw new Error(`Invalid non-female report found in collection: ${report.output}`);
      }

      for (const obj of report.objects) {
        const vocab = terminology.get(obj.term.toLowerCase());
        if (!vocab) {
          throw new Error(`Unresolved anatomical term '${obj.term}' (${obj.node}) in TA2 database.`);
        }

        if (organIdRegistry.has(obj.organ_id)) {
          const priorNode = organIdRegistry.get(obj.organ_id);
          throw new Error(
            `Duplicate female organ identifier: ${obj.organ_id} ('${priorNode}' vs '${obj.node}')`,
          );
        }
        organIdRegistry.set(obj.organ_id, obj.node);

        compiledOrgans.push({
          organ_id: obj.organ_id,
          ta2_latin: vocab.la || vocab.en,
          name_en: obj.name,
          ...(obj.qualifier ? { qualifier: obj.qualifier } : {}),
          system: report.system,
          mesh_file: report.output,
          node: obj.node,
          path: Array.isArray(obj.path) ? obj.path : [],
        });
      }
    }

    if (compiledOrgans.length === 0) {
      throw new Error("No organs compiled for female anatomical manifest.");
    }

    const systemFrequencies = new Map();
    for (const item of compiledOrgans) {
      systemFrequencies.set(item.system, (systemFrequencies.get(item.system) || 0) + 1);
    }

    const manifestSystems = Array.from(systemFrequencies.entries())
      .map(([system, count]) => ({
        system,
        organ_count: count,
        load_on_start: true,
      }))
      .sort((a, b) => a.system.localeCompare(b.system));

    compiledOrgans.sort((a, b) => a.ta2_latin.localeCompare(b.ta2_latin));

    const manifestPayload = {
      version: 1,
      gender_model: "female",
      attribution: FemaleAtlasManifestGenerator.ATTRIBUTION,
      credit: FemaleAtlasManifestGenerator.CREDIT,
      license: FemaleAtlasManifestGenerator.LICENSE,
      source: SOURCE,
      systems: manifestSystems,
      organs: compiledOrgans,
    };

    writeFileSync(TARGET_FEMALE_MANIFEST, `${JSON.stringify(manifestPayload, null, 2)}\n`, "utf8");

    console.log(`Wrote ${TARGET_FEMALE_MANIFEST}`);
    console.log(`  ${compiledOrgans.length} structures total`);
    for (const sys of manifestSystems) {
      console.log(`  ${sys.system}: ${sys.organ_count} (eager)`);
    }
  }

  readInspectionReports() {
    if (!existsSync(FEMALE_REPORTS_DIR)) {
      throw new Error(`Female report directory missing: ${FEMALE_REPORTS_DIR}`);
    }

    const reportFiles = readdirSync(FEMALE_REPORTS_DIR)
      .filter((file) => file.endsWith(".json"))
      .sort();

    if (reportFiles.length === 0) {
      throw new Error(`No reports found in ${FEMALE_REPORTS_DIR}`);
    }

    return reportFiles.map((file) =>
      JSON.parse(readFileSync(join(FEMALE_REPORTS_DIR, file), "utf8")),
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  new FemaleAtlasManifestGenerator().compile();
}

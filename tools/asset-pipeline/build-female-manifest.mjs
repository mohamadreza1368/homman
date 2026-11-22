#!/usr/bin/env node
/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Female Anatomical Manifest Compiler.
 * Compiles NIH Human Reference Atlas (Visible Human Female) reports into manifest_female.json.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTa2 } from "./ta2.mjs";
import { SOURCE } from "./hra-selection.mjs";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(CURRENT_DIR, "..", "..");
const TA2_PATH = join(CURRENT_DIR, "vendor", "TA2.csv");
const FEMALE_REPORTS_DIR = join(CURRENT_DIR, "vendor", "reports-female");
const FEMALE_MANIFEST_PATH = join(ROOT_DIR, "public", "anatomy", "manifest_female.json");

/**
 * Compiles the female anatomical manifest from extracted HRA system reports.
 */
export class FemaleAnatomyManifestCompiler {
  static ATTRIBUTION =
    "Meshes from the Human Reference Atlas (HRA) 3D Reference Organ Library, HuBMAP Consortium / NIH (CC BY 4.0), derived from the Visible Human Female dataset of the U.S. National Library of Medicine. See NOTICE.";
  static CREDIT = "NIH Human Reference Atlas / Visible Human Female (NLM)";
  static LICENSE = "CC-BY-4.0";

  compile() {
    const dictionary = parseTa2(readFileSync(TA2_PATH, "utf8"));
    const reports = this.readReports();

    const collectedOrgans = [];
    const registeredIds = new Map();

    for (const report of reports) {
      if (report.sex !== "female") {
        throw new Error(`Invalid non-female report found in collection: ${report.output}`);
      }

      for (const item of report.objects) {
        const vocab = dictionary.get(item.term.toLowerCase());
        if (!vocab) {
          throw new Error(`Unresolved anatomical term '${item.term}' (${item.node}) in TA2 database.`);
        }

        if (registeredIds.has(item.organ_id)) {
          const prev = registeredIds.get(item.organ_id);
          throw new Error(`Duplicate female organ identifier: ${item.organ_id} ('${prev}' vs '${item.node}')`);
        }
        registeredIds.set(item.organ_id, item.node);

        collectedOrgans.push({
          organ_id: item.organ_id,
          ta2_latin: vocab.la || vocab.en,
          name_en: item.name,
          ...(item.qualifier ? { qualifier: item.qualifier } : {}),
          system: report.system,
          mesh_file: report.output,
          node: item.node,
          path: Array.isArray(item.path) ? item.path : [],
        });
      }
    }

    if (collectedOrgans.length === 0) {
      throw new Error("No organs compiled for female anatomical manifest.");
    }

    const systemCounts = new Map();
    for (const organ of collectedOrgans) {
      systemCounts.set(organ.system, (systemCounts.get(organ.system) || 0) + 1);
    }

    const manifestSystems = Array.from(systemCounts.entries())
      .map(([system, count]) => ({
        system,
        organ_count: count,
        load_on_start: true,
      }))
      .sort((a, b) => a.system.localeCompare(b.system));

    collectedOrgans.sort((a, b) => a.ta2_latin.localeCompare(b.ta2_latin));

    const manifestData = {
      version: 1,
      gender_model: "female",
      attribution: FemaleAnatomyManifestCompiler.ATTRIBUTION,
      credit: FemaleAnatomyManifestCompiler.CREDIT,
      license: FemaleAnatomyManifestCompiler.LICENSE,
      source: SOURCE,
      systems: manifestSystems,
      organs: collectedOrgans,
    };

    writeFileSync(FEMALE_MANIFEST_PATH, `${JSON.stringify(manifestData, null, 2)}\n`, "utf8");

    console.log(`Wrote ${FEMALE_MANIFEST_PATH}`);
    console.log(`  ${collectedOrgans.length} structures total`);
    for (const s of manifestSystems) {
      console.log(`  ${s.system}: ${s.organ_count} (eager)`);
    }
  }

  readReports() {
    if (!existsSync(FEMALE_REPORTS_DIR)) {
      throw new Error(`Female report directory missing: ${FEMALE_REPORTS_DIR}`);
    }

    const filenames = readdirSync(FEMALE_REPORTS_DIR).filter((f) => f.endsWith(".json")).sort();
    if (filenames.length === 0) {
      throw new Error(`No reports found in ${FEMALE_REPORTS_DIR}`);
    }

    return filenames.map((file) => JSON.parse(readFileSync(join(FEMALE_REPORTS_DIR, file), "utf8")));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  new FemaleAnatomyManifestCompiler().compile();
}

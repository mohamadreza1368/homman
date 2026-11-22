/**
 * HOOMAAN Asset Pipeline: Female Atlas Structure Selection and Nomenclature Resolution.
 * Loads verified anatomical mappings between Human Reference Atlas (HRA) nodes and TA2 terms.
 *
 * Clean-room implementation based on specs/asset-pipeline-hra-extraction.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const rawCatalog = JSON.parse(
  readFileSync(join(CURRENT_DIR, "hra_female_data.json"), "utf8"),
);

export const SOURCE = Object.freeze(rawCatalog.source);
export const NOT_IN_TA2 = Object.freeze(rawCatalog.notInTa2);
export const OUT_OF_SCOPE = Object.freeze(rawCatalog.outOfScope);
export const KNOWN_SOURCE_ERRATA = Object.freeze(rawCatalog.knownErrata);
export const VENDOR_TA2_DEFECTS = Object.freeze(rawCatalog.vendorDefects);
export const STRUCTURES = Object.freeze(rawCatalog.structures);

const ROOT_TAXONOMY_TO_SYSTEM = Object.freeze({
  "Uterus": "reproductive",
  "Uterine tube": "reproductive",
  "Ovary": "reproductive",
  "Vagina": "reproductive",
  "Ligaments of uterus and ovary": "reproductive",
  "Urinary bladder": "renal",
  "Ureter": "renal",
  "Kidney": "renal",
  "Pelvic girdle": "skeletal",
  "Vertebral column": "skeletal",
  "Large intestine": "digestive",
  "Small intestine": "digestive",
  "Liver": "digestive",
  "Biliary tract": "digestive",
  "Pancreas": "digestive",
  "Breast": "integumentary",
  "Spleen": "lymphatic",
  "Pelvic vessels": "cardiovascular",
  "Abdominal vessels": "cardiovascular",
});

/**
 * Human Reference Atlas Female Organ Taxonomy Resolver.
 */
export class HraTaxonomyRegistry {
  static resolveSystem(rootCategory) {
    const system = ROOT_TAXONOMY_TO_SYSTEM[rootCategory];
    if (!system) {
      throw new Error(`Unmapped anatomical system category for path: "${rootCategory}"`);
    }
    return system;
  }

  static buildSystemMap(structures) {
    return new Map(
      structures.map((entry) => [
        entry.node,
        this.resolveSystem(entry.path[0]),
      ]),
    );
  }
}

export const SYSTEM_OF = Object.freeze(
  HraTaxonomyRegistry.buildSystemMap(STRUCTURES),
);

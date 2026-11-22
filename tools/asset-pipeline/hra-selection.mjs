/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Human Reference Atlas (HRA) Female Organ Taxonomy & Selection Registry.
 *
 * Clean-room implementation designed from specs/asset-pipeline-hra-extraction.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const HRA_DATA = JSON.parse(
  readFileSync(join(CURRENT_DIR, "hra_female_data.json"), "utf8"),
);

export const SOURCE = Object.freeze(HRA_DATA.source);
export const NOT_IN_TA2 = Object.freeze(HRA_DATA.notInTa2);
export const OUT_OF_SCOPE = Object.freeze(HRA_DATA.outOfScope);
export const KNOWN_SOURCE_ERRATA = Object.freeze(HRA_DATA.knownErrata);
export const VENDOR_TA2_DEFECTS = Object.freeze(HRA_DATA.vendorDefects);
export const STRUCTURES = Object.freeze(HRA_DATA.structures);

const TAXONOMY_ROOT_SYSTEM_MAP = Object.freeze({
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
 * Registry service for resolving Human Reference Atlas structures and systems.
 */
export class FemaleAtlasRegistry {
  /**
   * Resolves anatomical system from a root category name.
   * @param {string} rootCategory
   * @returns {string}
   */
  static resolveSystem(rootCategory) {
    const system = TAXONOMY_ROOT_SYSTEM_MAP[rootCategory];
    if (!system) {
      throw new Error(`Unmapped anatomical system category for path: "${rootCategory}"`);
    }
    return system;
  }

  /**
   * Builds node-to-system lookup index.
   * @param {Array<object>} structureList
   * @returns {Map<string, string>}
   */
  static buildSystemIndex(structureList) {
    return new Map(
      structureList.map((item) => [
        item.node,
        this.resolveSystem(item.path[0]),
      ]),
    );
  }
}

export const SYSTEM_OF = Object.freeze(
  FemaleAtlasRegistry.buildSystemIndex(STRUCTURES),
);

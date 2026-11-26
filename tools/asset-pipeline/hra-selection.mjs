/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Female Atlas Registry & HRA Organ Selection
 *
 * Designed from specs/asset-pipeline-hra-extraction.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FEMALE_DATA_FILE = join(SCRIPT_DIR, "hra_female_data.json");

function loadFemaleDataset() {
  const rawJson = readFileSync(FEMALE_DATA_FILE, "utf8");
  return JSON.parse(rawJson);
}

const FEMALE_DATASET = loadFemaleDataset();

export const SOURCE = Object.freeze(FEMALE_DATASET.source);
export const NOT_IN_TA2 = Object.freeze(FEMALE_DATASET.notInTa2 || {});
export const OUT_OF_SCOPE = Object.freeze(FEMALE_DATASET.outOfScope || {});
export const KNOWN_SOURCE_ERRATA = Object.freeze(FEMALE_DATASET.knownErrata || {});
export const VENDOR_TA2_DEFECTS = Object.freeze(FEMALE_DATASET.vendorDefects || {});
export const STRUCTURES = Object.freeze(FEMALE_DATASET.structures || []);

const ROOT_CATEGORY_SYSTEM_TABLE = Object.freeze({
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
 * Service for resolving anatomical categories and node mappings for the female atlas.
 */
export class FemaleAtlasRegistry {
  /**
   * Resolves the anatomical system given a top-level taxonomy branch name.
   * @param {string} rootCategory
   * @returns {string}
   */
  static resolveSystem(rootCategory) {
    const matched = ROOT_CATEGORY_SYSTEM_TABLE[rootCategory];
    if (!matched) {
      throw new Error(`Unmapped anatomical system category for path: "${rootCategory}"`);
    }
    return matched;
  }

  /**
   * Builds an index relating glTF node identifiers to their anatomical system.
   * @param {readonly Array<{ node: string, path: string[] }>} items
   * @returns {Map<string, string>}
   */
  static buildSystemIndex(items) {
    const nodeMap = new Map();
    for (const item of items) {
      if (item && item.node && Array.isArray(item.path) && item.path.length > 0) {
        nodeMap.set(item.node, this.resolveSystem(item.path[0]));
      }
    }
    return nodeMap;
  }
}

export const SYSTEM_OF = Object.freeze(
  FemaleAtlasRegistry.buildSystemIndex(STRUCTURES),
);

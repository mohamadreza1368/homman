/**
 * HOOMAAN Asset Pipeline: Female Atlas Structure Selection and Nomenclature Resolution.
 * Loads verified anatomical mappings between Human Reference Atlas (HRA) nodes and TA2 terms.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const rawCatalog = JSON.parse(
  readFileSync(join(CURRENT_DIR, "hra_female_data.json"), "utf8"),
);

export const SOURCE = rawCatalog.source;
export const NOT_IN_TA2 = rawCatalog.notInTa2;
export const OUT_OF_SCOPE = rawCatalog.outOfScope;
export const KNOWN_SOURCE_ERRATA = rawCatalog.knownErrata;
export const VENDOR_TA2_DEFECTS = rawCatalog.vendorDefects;
export const STRUCTURES = rawCatalog.structures;

const SYSTEM_ROUTING_TABLE = {
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
};

export const SYSTEM_OF = new Map(
  STRUCTURES.map((item) => {
    const rootPath = item.path[0];
    const system = SYSTEM_ROUTING_TABLE[rootPath];
    if (!system) {
      throw new Error(`Unmapped anatomical system category for path: "${rootPath}"`);
    }
    return [item.node, system];
  }),
);

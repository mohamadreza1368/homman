/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Anatomical Terminology & Vocabulary Normalization
 *
 * Designed from specs/asset-pipeline-terminologia-anatomica.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PATCHES_FILE = join(SCRIPT_DIR, "ta2_patches.json");

function loadPatchData() {
  const content = readFileSync(PATCHES_FILE, "utf8");
  return JSON.parse(content);
}

const PATCH_DATA = loadPatchData();

export const TA2_CORRECTIONS = Object.freeze(PATCH_DATA.ta2_corrections || {});
export const ADDED_TERM_CORRECTIONS = Object.freeze(PATCH_DATA.added_term_corrections || {});
export const ADDED_TERM_OPEN_QUESTIONS = Object.freeze(PATCH_DATA.open_questions || {});

/**
 * Text normalization utilities for anatomical nomenclature.
 */
export class TextNormalizer {
  /**
   * Eliminates Latin diacritical accents to produce clean NFC text.
   * @param {string} input
   * @returns {string}
   */
  static stripAccents(input) {
    if (typeof input !== "string" || input.length === 0) return "";
    return input.normalize("NFD").replace(/\p{Diacritic}/gu, "").normalize("NFC");
  }

  /**
   * Creates a filesystem and URL-safe alphanumeric slug.
   * @param {string} label
   * @returns {string}
   */
  static slugify(label) {
    if (!label) return "";
    const clean = TextNormalizer.stripAccents(label).toLowerCase();
    return clean
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
}

/**
 * High-performance parser and lookup dictionary for Terminologia Anatomica 2.
 */
export class TerminologyAtlas {
  constructor(
    customOverrides = { ...TA2_CORRECTIONS, ...ADDED_TERM_CORRECTIONS },
    auditChecklist = ADDED_TERM_OPEN_QUESTIONS,
  ) {
    this.overrides = customOverrides;
    this.auditKeys = auditChecklist;
  }

  static cleanAccents(text) {
    return TextNormalizer.stripAccents(text);
  }

  static createSlug(label) {
    return TextNormalizer.slugify(label);
  }

  /**
   * Parses semicolon-delimited CSV text and builds the vocabulary map.
   * @param {string} csvData
   * @returns {Map<string, { en: string, la: string }>}
   */
  parseCsv(csvData) {
    if (!csvData || typeof csvData !== "string" || csvData.trim().length === 0) {
      throw new Error("Empty TA2 CSV dataset provided.");
    }

    // Strip leading UTF-8 Byte Order Mark if present
    const rawText = csvData.charCodeAt(0) === 0xfeff ? csvData.slice(1) : csvData;
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("TA2 dataset does not contain enough records.");
    }

    const headerCols = lines[0].split(";").map((col) => col.trim().replace(/^"|"$/g, ""));
    const englishIndex = headerCols.indexOf("English");
    const latinIndex = headerCols.indexOf("Latin");

    if (englishIndex === -1 || latinIndex === -1) {
      throw new Error(`TA2.csv missing required headers (English, Latin). Found: ${headerCols.join(";")}`);
    }

    const termMap = new Map();

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(";").map((item) => item.trim().replace(/^"|"$/g, ""));
      if (row.length !== headerCols.length) continue;

      const enRaw = row[englishIndex];
      if (!enRaw) continue;

      const lookupKey = enRaw.toLowerCase();
      if (!termMap.has(lookupKey)) {
        const override = this.overrides[lookupKey];
        const laRaw = row[latinIndex] || "";
        const finalLatin = override?.la || TextNormalizer.stripAccents(laRaw);
        const finalEnglish = override?.en || enRaw;

        termMap.set(lookupKey, {
          en: finalEnglish,
          la: finalLatin,
        });
      }
    }

    // Verify all specified corrections correspond to known vocabulary entries
    const mandatoryKeys = new Set([
      ...Object.keys(this.overrides),
      ...Object.keys(this.auditKeys),
    ]);

    for (const key of mandatoryKeys) {
      if (!termMap.has(key)) {
        throw new Error(`Correction specified for non-existent vocabulary key: "${key}".`);
      }
    }

    return termMap;
  }

  // Alias for backward compatibility
  parseCsvRecords(csvData) {
    return this.parseCsv(csvData);
  }
}

// Ergonomic module-level helpers
export const cleanAccents = TextNormalizer.stripAccents;
export const createSlug = TextNormalizer.slugify;
export const AnatomicalTerminologyService = TerminologyAtlas;

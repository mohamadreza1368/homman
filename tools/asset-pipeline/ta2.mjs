/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Terminologia Anatomica 2 (TA2) Vocabulary Normalization & Slugging.
 *
 * Clean-room implementation designed from specs/asset-pipeline-terminologia-anatomica.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PATCH_STORE = JSON.parse(
  readFileSync(join(CURRENT_DIR, "ta2_patches.json"), "utf8"),
);

export const TA2_CORRECTIONS = Object.freeze(PATCH_STORE.ta2_corrections);
export const ADDED_TERM_CORRECTIONS = Object.freeze(PATCH_STORE.added_term_corrections);
export const ADDED_TERM_OPEN_QUESTIONS = Object.freeze(PATCH_STORE.open_questions);

/**
 * Service for loading, normalizing, and indexing Terminologia Anatomica 2 vocabularies.
 */
export class AnatomicalTerminologyService {
  constructor(
    customOverrides = { ...TA2_CORRECTIONS, ...ADDED_TERM_CORRECTIONS },
    auditChecklist = ADDED_TERM_OPEN_QUESTIONS,
  ) {
    this.overrides = customOverrides;
    this.auditChecklist = auditChecklist;
  }

  /**
   * Removes Latin diacritical accents (macrons, breves, accents) and produces NFC normalized text.
   * @param {string} text
   * @returns {string}
   */
  static cleanAccents(text) {
    if (!text) return "";
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").normalize("NFC");
  }

  /**
   * Converts any raw anatomical label into a clean, deterministic, URL/filesystem-safe slug.
   * @param {string} label
   * @returns {string}
   */
  static createSlug(label) {
    return this.cleanAccents(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  /**
   * Ingests semicolon-delimited TA2 CSV content into a fast-lookup dictionary.
   * @param {string} csvContent
   * @returns {Map<string, { en: string, la: string }>}
   */
  parseCsvRecords(csvContent) {
    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error("Empty TA2 CSV dataset provided.");
    }

    // Strip optional UTF-8 Byte Order Mark
    const sanitized = csvContent.charCodeAt(0) === 0xfeff ? csvContent.slice(1) : csvContent;
    const records = sanitized.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (records.length < 2) {
      throw new Error("TA2 dataset does not contain enough records.");
    }

    const header = records[0].split(";").map((col) => col.trim().replace(/^"|"$/g, ""));
    const englishIdx = header.indexOf("English");
    const latinIdx = header.indexOf("Latin");

    if (englishIdx === -1 || latinIdx === -1) {
      throw new Error(`TA2.csv missing required headers (English, Latin). Found: ${header.join(";")}`);
    }

    const vocabularyIndex = new Map();

    for (let r = 1; r < records.length; r++) {
      const columns = records[r].split(";").map((val) => val.trim().replace(/^"|"$/g, ""));
      if (columns.length !== header.length) continue;

      const rawEnglish = columns[englishIdx];
      if (!rawEnglish) continue;

      const normalizedKey = rawEnglish.toLowerCase();
      if (!vocabularyIndex.has(normalizedKey)) {
        const override = this.overrides[normalizedKey];
        const rawLatin = columns[latinIdx] || "";
        const cleanLatin = override?.la || AnatomicalTerminologyService.cleanAccents(rawLatin);
        const cleanEnglish = override?.en || rawEnglish;

        vocabularyIndex.set(normalizedKey, {
          en: cleanEnglish,
          la: cleanLatin,
        });
      }
    }

    // Enforce completeness: all specified patch rules must resolve to actual vocabulary records
    const requiredKeys = new Set([
      ...Object.keys(this.overrides),
      ...Object.keys(this.auditChecklist),
    ]);

    for (const key of requiredKeys) {
      if (!vocabularyIndex.has(key)) {
        throw new Error(`Correction specified for non-existent vocabulary key: "${key}".`);
      }
    }

    return vocabularyIndex;
  }
}

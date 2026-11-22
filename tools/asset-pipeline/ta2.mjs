/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Terminologia Anatomica 2 (TA2) Indexing and Nomenclature Resolution.
 *
 * Clean-room implementation based on specs/asset-pipeline-terminologia-anatomica.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PATCHES_DATA = JSON.parse(
  readFileSync(join(SCRIPT_DIR, "ta2_patches.json"), "utf8"),
);

export const TA2_CORRECTIONS = Object.freeze(PATCHES_DATA.ta2_corrections);
export const ADDED_TERM_CORRECTIONS = Object.freeze(PATCHES_DATA.added_term_corrections);
export const ADDED_TERM_OPEN_QUESTIONS = Object.freeze(PATCHES_DATA.open_questions);

/**
 * Clean-room parser and normalizer for international anatomical terminology (TA2).
 */
export class TerminologiaAnatomicaIndexer {
  constructor(
    patchRules = { ...TA2_CORRECTIONS, ...ADDED_TERM_CORRECTIONS },
    openQuestions = ADDED_TERM_OPEN_QUESTIONS,
  ) {
    this.overrides = patchRules;
    this.auditQuestions = openQuestions;
  }

  /**
   * Strips Latin diacritical accents and normalizes text into canonical NFC.
   * @param {string} text
   * @returns {string}
   */
  static stripDiacritics(text) {
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").normalize("NFC");
  }

  /**
   * Generates a deterministic, URL- and filesystem-safe alphanumeric slug.
   * @param {string} text
   * @returns {string}
   */
  static toSlug(text) {
    return this.stripDiacritics(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  /**
   * Parses semicolon-delimited TA2 CSV content and creates an in-memory lookup index.
   * @param {string} rawCsv
   * @returns {Map<string, { en: string, la: string }>}
   */
  parse(rawCsv) {
    if (!rawCsv || rawCsv.trim().length === 0) {
      throw new Error("Empty TA2 CSV dataset provided.");
    }

    // Strip optional UTF-8 BOM
    const content = rawCsv.charCodeAt(0) === 0xfeff ? rawCsv.slice(1) : rawCsv;
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new Error("TA2 dataset does not contain enough records.");
    }

    const headerColumns = lines[0].split(";").map((col) => col.trim().replace(/^"|"$/g, ""));
    const englishColIdx = headerColumns.indexOf("English");
    const latinColIdx = headerColumns.indexOf("Latin");

    if (englishColIdx === -1 || latinColIdx === -1) {
      throw new Error(
        `TA2.csv missing required headers (English, Latin). Found: ${headerColumns.join(";")}`,
      );
    }

    const vocabularyMap = new Map();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cells = line.split(";").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cells.length !== headerColumns.length) continue;

      const englishTerm = cells[englishColIdx];
      if (!englishTerm) continue;

      const lookupKey = englishTerm.toLowerCase();
      if (!vocabularyMap.has(lookupKey)) {
        const override = this.overrides[lookupKey];
        const rawLatin = cells[latinColIdx] || "";
        const normalizedLatin = override?.la || TerminologiaAnatomicaIndexer.stripDiacritics(rawLatin);
        const normalizedEnglish = override?.en || englishTerm;

        vocabularyMap.set(lookupKey, {
          en: normalizedEnglish,
          la: normalizedLatin,
        });
      }
    }

    // Integrity audit: Verify that all expected overrides and open questions exist
    const requiredAuditKeys = new Set([
      ...Object.keys(this.overrides),
      ...Object.keys(this.auditQuestions),
    ]);

    for (const key of requiredAuditKeys) {
      if (!vocabularyMap.has(key)) {
        throw new Error(`Correction specified for non-existent vocabulary key: "${key}".`);
      }
    }

    return vocabularyMap;
  }
}

/**
 * Ingests semicolon-delimited TA2 CSV content and returns a dictionary indexed by lowercase English terms.
 * @param {string} rawCsv
 * @returns {Map<string, { en: string, la: string }>}
 */
export function parseTa2(rawCsv) {
  return new TerminologiaAnatomicaIndexer().parse(rawCsv);
}

/**
 * Deterministically transforms an anatomical name into a safe, normalized alphanumeric slug identifier.
 * @param {string} term
 * @returns {string}
 */
export function slugify(term) {
  return TerminologiaAnatomicaIndexer.toSlug(term);
}

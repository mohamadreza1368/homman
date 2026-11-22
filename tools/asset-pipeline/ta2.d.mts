/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Terminologia Anatomica 2 (TA2) indexing and vocabulary resolution.
 */

export interface AnatomicalNomenclatureEntry {
  readonly en: string;
  readonly la: string;
}

export type Ta2Term = AnatomicalNomenclatureEntry;
export type Ta2Correction = Partial<AnatomicalNomenclatureEntry>;

/** Canonical correction tables for known typographical or morphological inconsistencies. */
export declare const TA2_CORRECTIONS: Readonly<Record<string, Ta2Correction>>;
export declare const ADDED_TERM_CORRECTIONS: Readonly<Record<string, Ta2Correction>>;
export declare const ADDED_TERM_OPEN_QUESTIONS: Readonly<Record<string, string>>;

export declare class TerminologiaAnatomicaIndexer {
  constructor(
    patchRules?: Readonly<Record<string, Ta2Correction>>,
    openQuestions?: Readonly<Record<string, string>>,
  );
  static stripDiacritics(text: string): string;
  static toSlug(text: string): string;
  parse(rawCsv: string): Map<string, Ta2Term>;
}

/**
 * Ingests semicolon-delimited CSV text representing TA2 vocabulary and constructs
 * an in-memory lookup index keyed by lowercase English terms.
 */
export declare function parseTa2(rawCsvContent: string): Map<string, Ta2Term>;

/**
 * Converts any anatomical name or label into a deterministic, URL- and filesystem-safe slug.
 */
export declare function slugify(anatomicalLabel: string): string;

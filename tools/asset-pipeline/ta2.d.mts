/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Terminologia Anatomica 2 (TA2) indexing and vocabulary resolution.
 *
 * Clean-room specification-derived declarations.
 */

export interface AnatomicalTermDescriptor {
  readonly en: string;
  readonly la: string;
}

export type Ta2Term = AnatomicalTermDescriptor;
export type Ta2Correction = Partial<AnatomicalTermDescriptor>;

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

export declare function parseTa2(rawCsvContent: string): Map<string, Ta2Term>;
export declare function slugify(anatomicalLabel: string): string;

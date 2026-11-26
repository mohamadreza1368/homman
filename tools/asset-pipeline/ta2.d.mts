/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Anatomical Terminology & Vocabulary Normalization
 *
 * Designed from specs/asset-pipeline-terminologia-anatomica.md.
 */

export interface VocabularyTerm {
  readonly en: string;
  readonly la: string;
}

export type VocabularyPatch = Partial<VocabularyTerm>;

export interface TerminologyPatchStore {
  readonly ta2_corrections: Record<string, VocabularyPatch>;
  readonly added_term_corrections: Record<string, VocabularyPatch>;
  readonly open_questions: Record<string, string>;
}

export declare class TextNormalizer {
  static stripAccents(input: string): string;
  static slugify(label: string): string;
}

export declare class TerminologyAtlas {
  readonly overrides: Readonly<Record<string, VocabularyPatch>>;
  readonly auditKeys: Readonly<Record<string, string>>;

  constructor(
    customOverrides?: Readonly<Record<string, VocabularyPatch>>,
    auditChecklist?: Readonly<Record<string, string>>,
  );

  static cleanAccents(text: string): string;
  static createSlug(label: string): string;

  parseCsv(csvData: string): Map<string, VocabularyTerm>;
  parseCsvRecords(csvData: string): Map<string, VocabularyTerm>;
}

// Backward-compatible ergonomic aliases
export { TerminologyAtlas as AnatomicalTerminologyService };
export declare const cleanAccents: (text: string) => string;
export declare const createSlug: (label: string) => string;
export declare const TA2_CORRECTIONS: Readonly<Record<string, VocabularyPatch>>;
export declare const ADDED_TERM_CORRECTIONS: Readonly<Record<string, VocabularyPatch>>;
export declare const ADDED_TERM_OPEN_QUESTIONS: Readonly<Record<string, string>>;

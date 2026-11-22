/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Anatomical Terminology Service.
 *
 * Clean-room specification-derived declarations.
 */

export interface TerminologyRecord {
  readonly en: string;
  readonly la: string;
}

export type TerminologyCorrection = Partial<TerminologyRecord>;

export declare const TA2_CORRECTIONS: Readonly<Record<string, TerminologyCorrection>>;
export declare const ADDED_TERM_CORRECTIONS: Readonly<Record<string, TerminologyCorrection>>;
export declare const ADDED_TERM_OPEN_QUESTIONS: Readonly<Record<string, string>>;

export declare class AnatomicalTerminologyService {
  constructor(
    customOverrides?: Readonly<Record<string, TerminologyCorrection>>,
    auditChecklist?: Readonly<Record<string, string>>,
  );
  static cleanAccents(text: string): string;
  static createSlug(label: string): string;
  parseCsvRecords(csvContent: string): Map<string, TerminologyRecord>;
}

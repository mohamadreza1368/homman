// Typings for Terminologia Anatomica 2 nomenclature tables.

export interface Ta2Term {
  en: string;
  la: string;
}

export type Ta2Correction = Partial<Ta2Term>;

export const TA2_CORRECTIONS: Record<string, Ta2Correction>;
export const ADDED_TERM_CORRECTIONS: Record<string, Ta2Correction>;
export const ADDED_TERM_OPEN_QUESTIONS: Record<string, string>;

export function parseTa2(text: string): Map<string, Ta2Term>;
export function slugify(name: string): string;

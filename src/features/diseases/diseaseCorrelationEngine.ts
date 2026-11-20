/**
 * Disease & Pathology Correlation Engine
 *
 * Implemented strictly from specs/disease-pathology-catalog.md
 * Independent Clean-Room implementation for medical pathology cataloging,
 * organ correlation, and localized clinical search.
 */

export interface PathologyEntry {
  readonly id: string; // E.g., MONDO ID or internal key
  readonly titleFa: string;
  readonly titleEn: string;
  readonly icd10Code?: string;
  readonly affectedOrganIds: readonly string[];
  readonly summaryFa: string;
  readonly summaryEn?: string;
}

/**
 * Standard Persian/Arabic character normalizer for reliable substring queries.
 */
export function normalizeMedicalSearchTerm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip Arabic diacritics
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ') // zero-width spaces to space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filters pathology catalog by term across Persian name, English title, or ID/ICD codes.
 */
export function searchPathologyCatalog(
  query: string,
  catalog: readonly PathologyEntry[]
): readonly PathologyEntry[] {
  const normalizedQuery = normalizeMedicalSearchTerm(query);
  if (!normalizedQuery) {
    return [];
  }

  return catalog.filter((entry) => {
    const normFa = normalizeMedicalSearchTerm(entry.titleFa);
    const normEn = entry.titleEn.toLowerCase();
    const idMatch = entry.id.toLowerCase().includes(normalizedQuery);
    const icdMatch = entry.icd10Code
      ? entry.icd10Code.toLowerCase().includes(normalizedQuery)
      : false;

    return (
      normFa.includes(normalizedQuery) ||
      normEn.includes(normalizedQuery) ||
      idMatch ||
      icdMatch
    );
  });
}

/**
 * Finds all pathologies affecting a specific anatomical organ ID.
 */
export function findPathologiesByOrgan(
  organId: string,
  catalog: readonly PathologyEntry[]
): readonly PathologyEntry[] {
  const target = organId.trim().toLowerCase();
  if (!target) return [];

  return catalog.filter((entry) =>
    entry.affectedOrganIds.some((id) => id.toLowerCase() === target)
  );
}

/**
 * Retrieves the list of involved organ IDs for a given pathology.
 * If the disease has no localized organs (e.g. systemic shock), returns empty array.
 */
export function getInvolvedOrgansForPathology(
  pathologyId: string,
  catalog: readonly PathologyEntry[]
): readonly string[] {
  const match = catalog.find((entry) => entry.id === pathologyId);
  return match ? match.affectedOrganIds : [];
}

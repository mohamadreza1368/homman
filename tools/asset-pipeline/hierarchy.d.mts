/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for anatomical taxonomy tree curation and hierarchy repair.
 */

export interface AnatomicalTaxonomyEntity {
  organ_id: string;
  ta2_latin: string;
  system: string;
  path: string[];
  [extraProps: string]: unknown;
}

export type PlacedOrgan = AnatomicalTaxonomyEntity;

export interface HierarchyRepairSummary<T extends AnatomicalTaxonomyEntity = AnatomicalTaxonomyEntity> {
  organs: T[];
  corrected: number;
  propagated: number;
  renamed: number;
}

export declare const NERVOUS_PATHS: Readonly<Record<string, readonly string[]>>;

export declare class AnatomyHierarchyRepairPipeline {
  constructor(
    rules?: Readonly<Record<string, readonly string[]>>,
    renames?: Readonly<Record<string, string>>,
  );
  process<T extends AnatomicalTaxonomyEntity>(entities: readonly T[]): HierarchyRepairSummary<T>;
}

/**
 * Validates, re-roots, and aligns anatomical pathways for nervous and visceral structures.
 */
export declare function repairHierarchy<T extends AnatomicalTaxonomyEntity>(
  organEntities: readonly T[],
): HierarchyRepairSummary<T>;

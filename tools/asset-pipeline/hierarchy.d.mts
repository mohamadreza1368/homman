/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for anatomical taxonomy tree curation and hierarchy repair.
 *
 * Clean-room specification-derived declarations.
 */

export interface TaxonomyEntity {
  organ_id: string;
  ta2_latin: string;
  system: string;
  path: string[];
  [extraFields: string]: unknown;
}

export type PlacedOrgan = TaxonomyEntity;

export interface HierarchyRepairResult<T extends TaxonomyEntity = TaxonomyEntity> {
  organs: T[];
  corrected: number;
  propagated: number;
  renamed: number;
}

export declare const NERVOUS_PATHS: Readonly<Record<string, readonly string[]>>;
export declare const TAXONOMY_HEADING_REPLACEMENTS: Readonly<Record<string, string>>;

export declare class AnatomyHierarchyRepairPipeline {
  constructor(
    rules?: Readonly<Record<string, readonly string[]>>,
    renames?: Readonly<Record<string, string>>,
  );
  process<T extends TaxonomyEntity>(entities: readonly T[]): HierarchyRepairResult<T>;
}

export declare function repairHierarchy<T extends TaxonomyEntity>(
  organEntities: readonly T[],
): HierarchyRepairResult<T>;

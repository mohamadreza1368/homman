/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Anatomical Taxonomy Tree Harmonization
 *
 * Designed from specs/asset-pipeline-anatomical-hierarchy.md.
 */

export interface TaxonomyNode {
  organ_id: string;
  ta2_latin: string;
  system: string;
  path: string[];
  [propName: string]: unknown;
}

export interface HarmonizationSummary<T extends TaxonomyNode = TaxonomyNode> {
  organs: T[];
  corrected: number;
  propagated: number;
  renamed: number;
}

export declare class TaxonomyTreeHarmonizer {
  readonly pathOverrides: Readonly<Record<string, readonly string[]>>;
  readonly headingRenames: Readonly<Record<string, string>>;

  constructor(
    pathOverrides?: Readonly<Record<string, readonly string[]>>,
    headingRenames?: Readonly<Record<string, string>>,
  );

  harmonize<T extends TaxonomyNode>(items: readonly T[]): HarmonizationSummary<T>;
  curateOrganTaxonomy<T extends TaxonomyNode>(items: readonly T[]): HarmonizationSummary<T>;
}

// Backward-compatible ergonomic aliases
export { TaxonomyTreeHarmonizer as TaxonomyCurationEngine };
export declare const TAXONOMY_PATH_OVERRIDES: Readonly<Record<string, readonly string[]>>;
export declare const TAXONOMY_HEADING_REPLACEMENTS: Readonly<Record<string, string>>;

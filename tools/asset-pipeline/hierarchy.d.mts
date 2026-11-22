/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Anatomical Taxonomy Curation Engine.
 *
 * Clean-room specification-derived declarations.
 */

export interface AnatomicalNodeRecord {
  organ_id: string;
  ta2_latin: string;
  system: string;
  path: string[];
  [extraProps: string]: unknown;
}

export interface TaxonomyCurationReport<T extends AnatomicalNodeRecord = AnatomicalNodeRecord> {
  organs: T[];
  corrected: number;
  propagated: number;
  renamed: number;
}

export declare const TAXONOMY_PATH_OVERRIDES: Readonly<Record<string, readonly string[]>>;
export declare const TAXONOMY_HEADING_REPLACEMENTS: Readonly<Record<string, string>>;

export declare class TaxonomyCurationEngine {
  constructor(
    pathOverrides?: Readonly<Record<string, readonly string[]>>,
    headingRenames?: Readonly<Record<string, string>>,
  );
  curateOrganTaxonomy<T extends AnatomicalNodeRecord>(structures: readonly T[]): TaxonomyCurationReport<T>;
}

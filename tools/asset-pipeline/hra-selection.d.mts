/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Human Reference Atlas (HRA) organ selections, provenance, and taxonomy.
 *
 * Clean-room specification-derived declarations.
 */

import type { AnatomicalSystem } from "../../src/lib/schemas";

export type AnatomicalLaterality = "left" | "right" | null;

export interface ProvenanceSource {
  readonly version: string;
  readonly url: string;
  readonly metadata: string;
  readonly license: string;
  readonly licenseUrl: string;
}

export type HraSource = ProvenanceSource;

export interface AnatomicalStructureEntry {
  readonly node: string;
  readonly id: string;
  readonly term: string;
  readonly english?: string;
  readonly qualifier?: string;
  readonly side: AnatomicalLaterality;
  readonly path: readonly string[];
}

export type HraStructure = AnatomicalStructureEntry;

export declare const SOURCE: ProvenanceSource;
export declare const NOT_IN_TA2: Readonly<Record<string, string>>;
export declare const OUT_OF_SCOPE: Readonly<Record<string, string>>;
export declare const KNOWN_SOURCE_ERRATA: Readonly<Record<string, string>>;
export declare const VENDOR_TA2_DEFECTS: Readonly<Record<string, string>>;
export declare const STRUCTURES: readonly AnatomicalStructureEntry[];
export declare const SYSTEM_OF: ReadonlyMap<string, AnatomicalSystem>;

export declare class HraTaxonomyRegistry {
  static resolveSystem(rootCategory: string): AnatomicalSystem;
  static buildSystemMap(structures: readonly AnatomicalStructureEntry[]): Map<string, AnatomicalSystem>;
}

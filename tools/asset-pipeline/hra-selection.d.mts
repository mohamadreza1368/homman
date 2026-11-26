/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Female Atlas Registry & HRA Organ Selection
 *
 * Designed from specs/asset-pipeline-hra-extraction.md.
 */

import type { AnatomicalSystem } from "../../src/lib/schemas";

export type AnatomicalLaterality = "left" | "right" | null;

export interface ProvenanceDetails {
  readonly version: string;
  readonly url: string;
  readonly metadata: string;
  readonly license: string;
  readonly licenseUrl: string;
}

export interface FemaleStructureMetadata {
  readonly node: string;
  readonly id: string;
  readonly term: string;
  readonly english?: string;
  readonly qualifier?: string;
  readonly side: AnatomicalLaterality;
  readonly path: readonly string[];
}

export declare class FemaleAtlasRegistry {
  static resolveSystem(rootCategory: string): AnatomicalSystem;
  static buildSystemIndex(items: readonly FemaleStructureMetadata[]): Map<string, AnatomicalSystem>;
}

// Ergonomic exports & data constants
export declare const SOURCE: ProvenanceDetails;
export declare const NOT_IN_TA2: Readonly<Record<string, string>>;
export declare const OUT_OF_SCOPE: Readonly<Record<string, string>>;
export declare const KNOWN_SOURCE_ERRATA: Readonly<Record<string, string>>;
export declare const VENDOR_TA2_DEFECTS: Readonly<Record<string, string>>;
export declare const STRUCTURES: readonly FemaleStructureMetadata[];
export declare const SYSTEM_OF: ReadonlyMap<string, AnatomicalSystem>;

// Aliases
export type FemaleOrganEntry = FemaleStructureMetadata;
export type AtlasSourceProvenance = ProvenanceDetails;

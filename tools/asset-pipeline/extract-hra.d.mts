/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Female Geometry Extraction Engine.
 *
 * Clean-room specification-derived declarations.
 */

import type { FemaleOrganEntry } from "./hra-selection.d.mts";

export interface ClinicalNameDescriptor {
  term: string;
  english?: string;
  qualifier?: string;
  side?: "left" | "right" | null;
}

export declare class FemaleGeometryExtractor {
  static readonly PINNED_HASH: string;
  static formatClinicalName(entry: ClinicalNameDescriptor): string;
  static countMeshTriangles(mesh: unknown): number;
  execute(): Promise<void>;
}

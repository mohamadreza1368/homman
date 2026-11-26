/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: HRA Female Geometry Extraction & Draco Optimization Engine
 *
 * Designed from specs/asset-pipeline-hra-extraction.md.
 */

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

export { FemaleGeometryExtractor as HraGeometryExtractor };

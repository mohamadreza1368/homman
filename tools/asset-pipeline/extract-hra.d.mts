/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Human Reference Atlas 3D Extraction Pipeline.
 */

import type { HraStructure } from "./hra-selection.d.mts";

export declare class HraModelExtractor {
  static formatClinicalName(
    entry: Pick<HraStructure, "term"> & Partial<Pick<HraStructure, "english" | "qualifier" | "side">>,
  ): string;
  static tallyTriangles(mesh: unknown): number;
  execute(): Promise<void>;
}

export declare const displayName: typeof HraModelExtractor.formatClinicalName;

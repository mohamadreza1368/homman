/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Male Atlas Manifest Generator.
 *
 * Clean-room specification-derived declarations.
 */

export interface ParsedNodeIdentifier {
  readonly cleanName: string;
  readonly laterality: "left" | "right" | null;
}

export declare class MaleAtlasManifestGenerator {
  static parseNodeIdentifier(rawIdentifier: string): ParsedNodeIdentifier;
  static classifyVisceralOrgan(englishTerm: string): string | null;
  compile(): void;
  loadInspectionReports(): unknown[];
}

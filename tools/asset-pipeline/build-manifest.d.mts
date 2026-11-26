/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Male Atlas Manifest Compiler
 *
 * Designed from specs/asset-pipeline-manifest-builder.md.
 */

export interface ParsedNodeIdentifier {
  readonly cleanName: string;
  readonly laterality: "left" | "right" | null;
}

export declare class MaleAtlasManifestGenerator {
  static parseNodeIdentifier(rawIdentifier: string): ParsedNodeIdentifier;
  static classifyVisceralOrgan(englishTerm: string): string | null;
  loadInspectionReports(): unknown[];
  compile(): void;
}

export { MaleAtlasManifestGenerator as MaleManifestCompiler };

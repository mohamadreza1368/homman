/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Male Anatomy Manifest Compiler Type Definitions.
 *
 * Clean-room specification-derived declarations.
 */

export interface NormalizedBlenderNode {
  readonly cleanName: string;
  readonly laterality: "left" | "right" | null;
}

export declare class MaleAnatomyManifestCompiler {
  static normalizeBlenderIdentifier(rawLabel: string): NormalizedBlenderNode;
  static categorizeVisceralOrgan(englishTerm: string): string | null;
  compileManifest(): void;
}

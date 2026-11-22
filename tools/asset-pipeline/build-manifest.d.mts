/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Type definitions for Male Anatomy Manifest Compiler.
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

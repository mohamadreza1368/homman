/**
 * Hoomaan 3D Viewer - Scanner Laser Ring Tints & Spectral Intensities
 */

export type ScanTintId = "cyan" | "green" | "amber" | "violet";

export interface ScanTint {
  id: ScanTintId;
  label: string;
  hex: string;
  light: readonly [number, number, number];
}

export const SCAN_TINTS: readonly ScanTint[] = [
  { id: "cyan", label: "Cyan", hex: "#1ae0ff", light: [0.1, 1.2, 1.5] },
  { id: "green", label: "Green", hex: "#2bf07a", light: [0.14, 1.45, 0.55] },
  { id: "amber", label: "Amber", hex: "#ff9a3c", light: [1.5, 0.72, 0.14] },
  { id: "violet", label: "Violet", hex: "#b06cff", light: [0.92, 0.42, 1.6] },
];

export const DEFAULT_TINT: ScanTintId = "cyan";

/** Resolves scan tint configuration by id, falling back safely to default tint. */
export function scanTint(id: string | null | undefined): ScanTint {
  return SCAN_TINTS.find((t) => t.id === id) ?? SCAN_TINTS[0]!;
}

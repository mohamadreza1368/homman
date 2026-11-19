export type ScanTintId = "cyan" | "green" | "amber" | "violet";

export interface ScanTint {
  id: ScanTintId;
  label: string;
  hex: string;
  light: readonly [number, number, number];
}

const TINT_CATALOG: readonly ScanTint[] = Object.freeze([
  { id: "cyan", label: "Cyan", hex: "#1ae0ff", light: [0.1, 1.2, 1.5] },
  { id: "green", label: "Green", hex: "#2bf07a", light: [0.14, 1.45, 0.55] },
  { id: "amber", label: "Amber", hex: "#ff9a3c", light: [1.5, 0.72, 0.14] },
  { id: "violet", label: "Violet", hex: "#b06cff", light: [0.92, 0.42, 1.6] },
]);

export const SCAN_TINTS = TINT_CATALOG;
export const DEFAULT_TINT: ScanTintId = "cyan";

const TINT_INDEX = new Map<string, ScanTint>(
  TINT_CATALOG.map((entry) => [entry.id, entry])
);

export function scanTint(id: string | null | undefined): ScanTint {
  if (typeof id !== "string" || !TINT_INDEX.has(id)) {
    return TINT_CATALOG[0]!;
  }
  return TINT_INDEX.get(id)!;
}

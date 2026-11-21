// Typings for hierarchy correction utilities.

export interface PlacedOrgan {
  organ_id: string;
  ta2_latin: string;
  system: string;
  path: string[];
  [key: string]: unknown;
}

export const NERVOUS_PATHS: Record<string, string[]>;

export function repairHierarchy<T extends PlacedOrgan>(
  organs: T[],
): { organs: T[]; corrected: number; propagated: number; renamed?: number };

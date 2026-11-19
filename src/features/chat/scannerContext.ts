import type { SectionPlaneName } from "@/features/viewer/axialSlice";
import type { ScannerContext, SessionMode } from "@/lib/schemas";

type ScannedOrganEntry = ScannerContext["crossing"][number];

/** Maximum number of intersecting anatomical structures detailed in context. */
export const SCANNER_CROSSING_MAX = 12;

export interface ScannerAimInput {
  enabled: boolean;
  still: boolean;
  plane: SectionPlaneName;
  mode: SessionMode;
  selected: number;
  level: string | null;
  organIds: readonly string[];
  total: number;
  organ: (organId: string) => ScannedOrganEntry | null;
}

/**
 * Derives tomography scanner intersection context for the tutor prompt.
 * Only activates when an axial slice is stationary in tutor mode without active organ selection.
 */
export function scannerAim(input: ScannerAimInput): ScannerContext | null {
  if (!input.enabled || !input.still) {
    return null;
  }
  if (input.plane !== "axial" || input.mode !== "tutor") {
    return null;
  }
  if (input.selected > 0) {
    return null;
  }

  const intersectingOrgans: ScannedOrganEntry[] = [];
  for (const organId of input.organIds) {
    const item = input.organ(organId);
    if (item !== null) {
      intersectingOrgans.push(item);
      if (intersectingOrgans.length >= SCANNER_CROSSING_MAX) {
        break;
      }
    }
  }

  if (!input.level && intersectingOrgans.length === 0) {
    return null;
  }

  return {
    level: input.level,
    crossing: intersectingOrgans,
    total: Math.max(input.total, intersectingOrgans.length),
  };
}

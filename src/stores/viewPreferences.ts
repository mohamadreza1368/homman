import type { BackgroundMode } from "@/features/viewer/background";
import type { AnatomicalSystem } from "@/lib/schemas";
import { readLocal, writeLocal } from "@/lib/localStore";

/**
 * Persistent display and viewport preferences for HOOMAAN anatomy studio.
 *
 * Persists high-level configuration (system visibility, layer opacity, eye tracking,
 * lighting background, depth readout) synchronously via local storage so the viewport renders
 * without flickering on startup. Transient dissecting cuts are intentionally excluded.
 */
const VIEW_PREFERENCES_KEY = "hoomaan.view.v1";

export interface ViewPreferences {
  hiddenSystems: AnatomicalSystem[];
  systemOpacity: Partial<Record<AnatomicalSystem, number>>;
  eyeTracking: boolean;
  labelsVisible: boolean;
  background: BackgroundMode;
  depthProbeVisible: boolean;
  hideConnective: boolean;
}

const clampValue = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

/**
 * Validates and sanitizes persisted view preferences against the loaded anatomical manifest.
 */
export function sanitiseViewPreferences(
  raw: unknown,
  known: Iterable<AnatomicalSystem>,
): Partial<ViewPreferences> {
  if (typeof raw !== "object" || raw === null) return {};

  const record = raw as Record<string, unknown>;
  const recognizedSystems = new Set(known);
  const result: Partial<ViewPreferences> = {};

  if (Array.isArray(record.hiddenSystems)) {
    result.hiddenSystems = record.hiddenSystems.filter(
      (sys): sys is AnatomicalSystem =>
        typeof sys === "string" && recognizedSystems.has(sys as AnatomicalSystem),
    );
  }

  if (typeof record.systemOpacity === "object" && record.systemOpacity !== null) {
    const opacityMap: Partial<Record<AnatomicalSystem, number>> = {};
    for (const [key, val] of Object.entries(record.systemOpacity)) {
      if (!recognizedSystems.has(key as AnatomicalSystem)) continue;
      if (typeof val !== "number" || !Number.isFinite(val) || val >= 1) continue;
      opacityMap[key as AnatomicalSystem] = clampValue(val, 0.02, 0.99);
    }
    result.systemOpacity = opacityMap;
  }

  if (typeof record.eyeTracking === "boolean") result.eyeTracking = record.eyeTracking;
  if (typeof record.labelsVisible === "boolean") result.labelsVisible = record.labelsVisible;
  if (typeof record.hideConnective === "boolean") result.hideConnective = record.hideConnective;
  if (typeof record.depthProbeVisible === "boolean") result.depthProbeVisible = record.depthProbeVisible;
  if (record.background === "dark" || record.background === "light") {
    result.background = record.background;
  }

  return result;
}

export function readStoredView(): unknown {
  try {
    const raw = readLocal(VIEW_PREFERENCES_KEY);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredView(preferences: ViewPreferences): void {
  try {
    writeLocal(VIEW_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Gracefully handle storage quotas or disabled local storage
  }
}

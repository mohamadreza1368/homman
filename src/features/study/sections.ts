/**
 * Accordion section visibility configuration for the Study Journal drawer.
 * Organizes study notes, simulated clinical cases, and past dialogue sessions.
 */

export type StudySection = "notes" | "cases" | "sessions";

export const SECTIONS: StudySection[] = ["notes", "cases", "sessions"];

/** Default collapsed configuration when opening the study notebook without an active query. */
const DEFAULT_COLLAPSED_REST_STATE: Record<StudySection, boolean> = {
  notes: true,
  cases: false,
  sessions: false,
};

/** Fully expanded configuration ensuring search hits across all entities remain visible. */
const SEARCH_ACTIVE_EXPANDED_STATE: Record<StudySection, boolean> = {
  notes: false,
  cases: false,
  sessions: false,
};

/**
 * Derives initial section fold booleans based on search activity.
 * Returns fresh object copies to avoid mutating configuration dictionaries.
 */
export function foldStateFor(searching: boolean): Record<StudySection, boolean> {
  const blueprint = searching ? SEARCH_ACTIVE_EXPANDED_STATE : DEFAULT_COLLAPSED_REST_STATE;
  return { ...blueprint };
}

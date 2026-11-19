/**
 * Hoomaan 3D Viewer - Depth Reading Status & Labels
 */

export type DepthReading = "live" | "pinned";

/** Resolves active depth probe reading state based on pin flag. */
export function depthReadingState(pinned: boolean): DepthReading {
  return pinned ? "pinned" : "live";
}

export const HEADING: Record<DepthReading, string> = {
  live: "Under the cursor",
  pinned: "Through what you clicked",
};

export const SUBHEADING: Record<DepthReading, string> = {
  live: "surface inwards",
  pinned: "pinned — move freely",
};

export const DISMISS_HINT: Record<DepthReading, string> = {
  live: "Close this reading",
  pinned: "Let go of this reading",
};

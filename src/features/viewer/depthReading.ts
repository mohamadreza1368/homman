export type DepthReading = "live" | "pinned";

export function depthReadingState(isPinned: boolean): DepthReading {
  return isPinned ? "pinned" : "live";
}

const DESCRIPTORS = {
  live: {
    title: "Under the cursor",
    subtitle: "surface inwards",
    dismiss: "Close this reading",
  },
  pinned: {
    title: "Through what you clicked",
    subtitle: "pinned — move freely",
    dismiss: "Let go of this reading",
  },
} as const;

export const HEADING: Record<DepthReading, string> = {
  live: DESCRIPTORS.live.title,
  pinned: DESCRIPTORS.pinned.title,
};

export const SUBHEADING: Record<DepthReading, string> = {
  live: DESCRIPTORS.live.subtitle,
  pinned: DESCRIPTORS.pinned.subtitle,
};

export const DISMISS_HINT: Record<DepthReading, string> = {
  live: DESCRIPTORS.live.dismiss,
  pinned: DESCRIPTORS.pinned.dismiss,
};

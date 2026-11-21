import type { SessionDetail, StudyNote } from "@/lib/studyDb";
import type { MemoryKind } from "./memories";
import type { GraphicsStatus } from "./scene/memoryScene";

export const CLASSIFICATION_TITLES: Record<MemoryKind, string> = {
  session: "STUDY SESSION",
  case: "CASE VISIT",
  note: "NOTE",
};

export type ViewportLayoutTier = "wide" | "medium" | "compact";

export function computeLayoutTier(width: number, height: number): ViewportLayoutTier {
  if (width < 960 || height < 600) return "compact";
  if (width < 1320 || height < 780) return "medium";
  return "wide";
}

export const EXCLUDE_SURFACE_FILTER = /^(Hairs of|Eyelashes|Pubic hairs)/;
export const LOCAL_STORAGE_FOCUS_KEY = "hoomaan.memory.focus.v1";

export function retrievePersistedFocus(): boolean {
  try {
    return window.localStorage.getItem(LOCAL_STORAGE_FOCUS_KEY) === "on";
  } catch {
    return false;
  }
}

export function persistFocusSetting(active: boolean): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_FOCUS_KEY, active ? "on" : "off");
  } catch {
    // Gracefully ignore local storage restrictions
  }
}

export const EXTENDED_LOAD_WARNING_DELAY_MS = 15000;
export const CONTEXT_RESTORE_TIMEOUT_MS = 6000;
export const ERASE_HOLD_DURATION_MS = 1400;

export function evaluateGraphicsAdvisory(
  hasNoHardwareWebGL: boolean,
  gpuStatus: GraphicsStatus | null,
): string | null {
  if (hasNoHardwareWebGL) {
    return "THIS COMPUTER CANNOT DRAW THE HOLOGRAM · EVERY MEMORY IS STILL HERE TO READ";
  }
  if (!gpuStatus) return null;
  if (gpuStatus.lost) {
    return "THE GRAPHICS CARD RESET · RESTORING THE HOLOGRAM…";
  }
  if (gpuStatus.adapter === "software") {
    return "NO GRAPHICS ACCELERATION ON THIS COMPUTER · RUNNING LIGHT";
  }
  if (gpuStatus.eased) {
    return "EFFECTS EASED TO KEEP THE HOLOGRAM SMOOTH ON THIS COMPUTER";
  }
  return null;
}

export type MemoryInspectionState =
  | { state: "loading" }
  | { state: "session"; detail: SessionDetail }
  | { state: "note"; note: StudyNote }
  | { state: "missing" };

const REUSABLE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatEpochTimestamp = (ms: number) => REUSABLE_TIMESTAMP_FORMATTER.format(ms);

export function formatDiagnosticError(err: unknown): string {
  const messageStr = err instanceof Error ? err.message : String(err);
  if (/fetch|network|load/i.test(messageStr)) {
    return "The brain hologram could not be loaded. Your memories are safe — try again.";
  }
  return `The hologram stopped: ${messageStr}`;
}

export const CONTROL_GUIDE_CATALOG: readonly {
  title: string;
  items: readonly (readonly [string, string])[];
}[] = [
  {
    title: "THE BRAIN",
    items: [
      [
        "Point at a light",
        "Every light is a memory: cyan a study session, amber a case visit, violet a note. Pointing names it.",
      ],
      ["Click a light", "Opens that memory in the reader on the right."],
      ["Drag", "Turns the brain."],
      [
        "The strip at the bottom",
        "Every memory in the order you made it. Point or click, the same as on the brain.",
      ],
    ],
  },
  {
    title: "THE KEYS",
    items: [
      ["← →", "The previous or next memory, in the order you made them."],
      ["Enter", "Reads the open memory large, or back at the side."],
      [
        "Esc",
        "Steps back one thing at a time — the large reader, the memory, the index — and then leaves.",
      ],
      ["?", "Opens and closes this guide."],
    ],
  },
  {
    title: "THE READER",
    items: [
      ["⤢ / ⤡", "Reads the memory large, or back at the side."],
      ["Close", "Puts the memory away."],
      [
        "Hold to erase",
        "Hold until the bar fills. The memory dissolves and Restore brings it back for eight seconds; after that it is deleted from your journal for good.",
      ],
    ],
  },
  {
    title: "THE FIGURE",
    items: [
      ["Amber inside the body", "The structures the open memory was about, named underneath."],
      [
        "Point at a name",
        "Shows that structure alone, the others dimmed. Click it to keep it so; click again to see them all.",
      ],
      [
        "+ More / Show fewer",
        "Unfolds the rest of the list when there are more than the screen has room for.",
      ],
      [
        "⊕ Zoom in / ⊖ Whole body",
        "Moves in on the chosen structure — or on all of them — and holds the figure still; drag to turn it. Whole body steps back.",
      ],
      ["Drag", "Turns the figure."],
    ],
  },
  {
    title: "AT THE TOP",
    items: [
      ["Memory index", "The counts, the months and your most recent memories."],
      ["Focus", "Clears the film texture and sharpens the text for reading; the hologram keeps moving."],
      ["Sound", "Turns the tones that answer what you do on or off."],
      ["Exit", "Back to the atlas."],
    ],
  },
];

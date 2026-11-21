/**
 * Utility functions for study notes, cards, and session rows.
 */

export const NOTE_CLAMP_LINES = 4;
const ESTIMATED_CHARS_PER_LINE = 55;

export function preview(bodyText: string, limitChars = 140): string {
  const normalized = bodyText.replace(/\s+/g, " ").trim();
  return normalized.length <= limitChars ? normalized : `${normalized.slice(0, limitChars - 1)}…`;
}

export function isLongNote(bodyText: string, thresholdLines = NOTE_CLAMP_LINES): boolean {
  const lineCount = bodyText
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / ESTIMATED_CHARS_PER_LINE)), 0);
  return lineCount > thresholdLines;
}

export function determineScoreColor(scoreVal: number): string {
  if (scoreVal >= 71) return "text-emerald-400";
  if (scoreVal >= 41) return "text-amber-400";
  return "text-rose-400";
}

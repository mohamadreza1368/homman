import { stripOrganRefs } from "./organRefs";

/** Upper boundary on total characters processed for text-to-speech audio queuing. */
export const MAX_SPOKEN_CHARS = 8000;

/** Hard limit on character count per speech synthesis utterance to prevent browser stalls. */
const MAX_UTTERANCE_CHARS = 220;

/**
 * Strips formatting markup, URLs, code blocks, and visual markers from markdown prose
 * to prepare clean, phonetically natural text for the Web Speech API.
 */
export function speakableText(rawMarkdown: string, characterLimit = 0): string {
  let cleaned = stripOrganRefs(rawMarkdown);

  cleaned = cleaned
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*\d+\.[ \t]+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^[ \t]*([-*_])\1{2,}[ \t]*$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

  const maxAllowed =
    characterLimit > 0
      ? Math.min(characterLimit, MAX_SPOKEN_CHARS)
      : MAX_SPOKEN_CHARS;

  return clipAtNaturalBoundary(cleaned, maxAllowed);
}

/**
 * Truncates text cleanly at a sentence or word boundary if it exceeds the specified limit.
 */
function clipAtNaturalBoundary(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;

  const slice = str.slice(0, maxLen);
  const sentenceIndex = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
  );

  if (sentenceIndex > maxLen * 0.6) {
    return slice.slice(0, sentenceIndex + 1);
  }

  const spaceIndex = slice.lastIndexOf(" ");
  const base = spaceIndex > 0 ? slice.slice(0, spaceIndex) : slice;
  return base.trimEnd() + "…";
}

/**
 * Divides synthesized text into short sentence-oriented utterance segments
 * to guarantee complete playback without engine dropouts in Chromium and WebKit.
 */
export function speechChunks(fullText: string): string[] {
  const normalized = fullText.trim();
  if (!normalized) return [];

  const utteranceBatches: string[] = [];
  let buffer = "";

  const commitBuffer = () => {
    if (buffer) {
      utteranceBatches.push(buffer);
      buffer = "";
    }
  };

  const sentences = extractSentences(normalized);

  for (const sentence of sentences) {
    if (sentence.length > MAX_UTTERANCE_CHARS) {
      commitBuffer();
      utteranceBatches.push(...chunkWordsGreedily(sentence));
      continue;
    }

    const merged = buffer ? `${buffer} ${sentence}` : sentence;
    if (merged.length > MAX_UTTERANCE_CHARS) {
      commitBuffer();
      buffer = sentence;
    } else {
      buffer = merged;
    }
  }

  commitBuffer();
  return utteranceBatches;
}

function extractSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g);
  if (!parts) return [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

function chunkWordsGreedily(sentence: string): string[] {
  const tokens = sentence.split(/\s+/);
  const out: string[] = [];
  let currentGroup = "";

  for (const token of tokens) {
    const candidate = currentGroup ? `${currentGroup} ${token}` : token;
    if (candidate.length > MAX_UTTERANCE_CHARS && currentGroup) {
      out.push(currentGroup);
      currentGroup = token;
    } else {
      currentGroup = candidate;
    }
  }

  if (currentGroup) {
    out.push(currentGroup);
  }
  return out;
}

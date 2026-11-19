import type { ManifestOrgan } from "@/lib/schemas";

export interface Mention {
  latin: string;
  organIds: string[];
}

/** Maximum number of quick-jump structure buttons presented beneath an answer. */
export const MAX_MENTIONS = 8;

/**
 * Normalizes text to lowercase, stripped of diacritical marks/accents and collapsed spaces.
 */
export function normalise(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds an index mapping normalized Latin anatomical names (TA2) to organs and their IDs.
 */
export function latinIndex(organs: readonly ManifestOrgan[]): Map<string, Mention> {
  const dictionary = new Map<string, Mention>();

  for (const organ of organs) {
    const key = normalise(organ.ta2_latin);
    if (!key) continue;

    const existing = dictionary.get(key);
    if (existing) {
      existing.organIds.push(organ.organ_id);
    } else {
      dictionary.set(key, {
        latin: organ.ta2_latin,
        organIds: [organ.organ_id],
      });
    }
  }

  return dictionary;
}

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scans generated dialogue responses for mentions of recognized anatomical structures,
 * prioritizing parenthesized Latin names and multi-word Latin nomenclature.
 */
export function mentionedStructures(
  responseText: string,
  index: ReadonlyMap<string, Mention>,
): Mention[] {
  const normalizedText = normalise(responseText);
  const matchedPositions = new Map<string, number>();

  const recordMatch = (term: string, position: number) => {
    if (index.has(term)) {
      const prior = matchedPositions.get(term);
      if (prior === undefined || prior > position) {
        matchedPositions.set(term, position);
      }
    }
  };

  // Check parenthesized expressions for explicit Latin citations
  for (const match of normalizedText.matchAll(/\(([^()]{2,120})\)/g)) {
    const content = match[1];
    if (content) {
      const tokens = content.split(/[,;]/);
      for (const token of tokens) {
        recordMatch(token.trim(), match.index ?? 0);
      }
    }
  }

  // Check full text for multi-word Latin phrases on word boundaries
  for (const [key] of index.entries()) {
    if (!key.includes(" ")) continue;

    const pattern = new RegExp(`(^|[^\\p{L}])${escapeForRegex(key)}($|[^\\p{L}])`, "u");
    const offset = normalizedText.search(pattern);
    if (offset >= 0) {
      recordMatch(key, offset);
    }
  }

  return Array.from(matchedPositions.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, MAX_MENTIONS)
    .map(([key]) => index.get(key)!);
}

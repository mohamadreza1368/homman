/**
 * Inline links between the assistant's prose and the 3D model.
 *
 * The agent marks the structures it names with `[[organ_id]]` (see the SCENE
 * block in `engine/hoomaan_engine/prompts.py`). This module turns those markers
 * into numbered references so a long answer stays anchored to what is on
 * screen: hovering a number highlights the structure, clicking flies to it.
 *
 * Markers for structures the viewer cannot resolve are stripped rather than
 * shown. A model that invents an id should cost the reader a link, never leave
 * `[[spleen_of_omelas]]` sitting in the middle of a sentence.
 */

/** `[[organ_id]]` — ids are slugs, so the character class stays tight. */
const MARKER = /\[\[([a-z0-9_]+)\]\]/gi;
const RHYTHM_MARKER = /\[\[rhythm:([a-z0-9_]+)\]\]/gi;
const SLICE_MARKER = /\[\[slice:([a-z0-9_]+)\]\]/gi;

/** Custom href schemes; the Markdown renderer branches on them. */
export const REF_SCHEME = "hoomaan-ref:";
export const RHYTHM_SCHEME = "hoomaan-rhythm:";
export const SLICE_SCHEME = "hoomaan-slice:";

export interface OrganReference {
  organId: string;
  /** 1-based, in order of first appearance. */
  index: number;
}

/**
 * Extract references in order of first appearance, keeping only ids that exist.
 */
export function collectOrganRefs(
  markdown: string,
  isKnown: (organId: string) => boolean,
): OrganReference[] {
  const seen = new Map<string, number>();
  for (const match of markdown.matchAll(MARKER)) {
    const organId = match[1];
    if (!organId || seen.has(organId) || !isKnown(organId)) continue;
    seen.set(organId, seen.size + 1);
  }
  return [...seen].map(([organId, index]) => ({ organId, index }));
}

/**
 * Rewrite markers into links the Markdown renderer can pick up.
 *
 * Emitting a link rather than a bespoke token means the surrounding Markdown
 * keeps parsing normally — a marker inside a list item or a bold run still
 * lands in the right place.
 */
export function linkifyOrganRefs(
  markdown: string,
  refs: OrganReference[],
): string {
  const indexOf = new Map(refs.map((ref) => [ref.organId, ref.index]));
  let result = markdown.replace(MARKER, (_whole, rawId: string) => {
    const index = indexOf.get(rawId);
    // Unknown or duplicate-beyond-first: drop the marker, keep the prose clean.
    return index === undefined ? "" : `[${index}](${REF_SCHEME}${rawId})`;
  });

  result = result.replace(RHYTHM_MARKER, (_whole, rhythmId: string) => {
    return `[ریتم قلبی](${RHYTHM_SCHEME}${rhythmId})`;
  });

  result = result.replace(SLICE_MARKER, (_whole, sliceId: string) => {
    return `[برش توموگرافی](${SLICE_SCHEME}${sliceId})`;
  });

  return result;
}

/** Strip every marker — used for the copy-to-clipboard text. */
export function stripOrganRefs(markdown: string): string {
  // The space *before* the marker goes with it. Markers follow a word, so
  // removing the marker alone would leave "ventricle  is" or a space stranded
  // in front of a full stop — visible damage in text the user is pasting
  // somewhere else.
  return markdown
    .replace(/[ \t]?\[\[(?:(?:rhythm|slice):)?[a-z0-9_]+\]\]/gi, "");
}

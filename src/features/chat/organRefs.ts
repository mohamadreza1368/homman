/** Pattern matching inline organ reference markers: [[organ_slug]]. */
const ORGAN_MARKER_REGEX = /\[\[([a-z0-9_]+)\]\]/gi;
const CARDIAC_RHYTHM_REGEX = /\[\[rhythm:([a-z0-9_]+)\]\]/gi;
const AXIAL_SLICE_REGEX = /\[\[slice:([a-z0-9_]+)\]\]/gi;

/** URI protocols handled by markdown component for scene interaction. */
export const REF_SCHEME = "hoomaan-ref:";
export const RHYTHM_SCHEME = "hoomaan-rhythm:";
export const SLICE_SCHEME = "hoomaan-slice:";

export interface OrganReference {
  organId: string;
  index: number;
}

/**
 * Parses markdown to extract unique, validated organ references in their first order of appearance.
 */
export function collectOrganRefs(
  text: string,
  isValidOrgan: (id: string) => boolean,
): OrganReference[] {
  const discovered = new Map<string, number>();

  for (const match of text.matchAll(ORGAN_MARKER_REGEX)) {
    const slug = match[1];
    if (slug && !discovered.has(slug) && isValidOrgan(slug)) {
      discovered.set(slug, discovered.size + 1);
    }
  }

  return Array.from(discovered.entries()).map(([organId, index]) => ({
    organId,
    index,
  }));
}

/**
 * Transforms inline token markers into navigable markdown links.
 */
export function linkifyOrganRefs(
  content: string,
  references: OrganReference[],
): string {
  const indexLookup = new Map(references.map((r) => [r.organId, r.index]));

  let transformed = content.replace(ORGAN_MARKER_REGEX, (_match, organId: string) => {
    const num = indexLookup.get(organId);
    return num !== undefined ? `[${num}](${REF_SCHEME}${organId})` : "";
  });

  transformed = transformed.replace(CARDIAC_RHYTHM_REGEX, (_match, rhythmId: string) => {
    return `[ریتم قلبی](${RHYTHM_SCHEME}${rhythmId})`;
  });

  transformed = transformed.replace(AXIAL_SLICE_REGEX, (_match, sliceId: string) => {
    return `[برش توموگرافی](${SLICE_SCHEME}${sliceId})`;
  });

  return transformed;
}

/**
 * Purges all annotation bracket tags from raw text for clean clipboard operations.
 */
export function stripOrganRefs(content: string): string {
  return content.replace(/[ \t]?\[\[(?:(?:rhythm|slice):)?[a-z0-9_]+\]\]/gi, "");
}

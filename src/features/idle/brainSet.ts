import type { ManifestOrgan } from "@/lib/schemas";

/** Canonical hierarchy identifier marking intracranial brain structures. */
const ROOT_BRAIN_NODE = "Brain";

/**
 * Extracts and sorts anatomical organ IDs belonging to the cranial brain hierarchy.
 */
export function brainOrganIds(organManifest: readonly ManifestOrgan[]): string[] {
  return organManifest
    .filter((entry) => entry.path?.includes(ROOT_BRAIN_NODE))
    .map((entry) => entry.organ_id)
    .sort();
}

/** Minimum threshold of loaded brain meshes required to render the resting canvas. */
export const ENOUGH_TO_DRAW = 40;

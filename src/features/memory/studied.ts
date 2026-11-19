import { collectOrganRefs } from "@/features/chat/organRefs";
import type { ManifestOrgan } from "@/lib/schemas";

export interface StudiedOrgan {
  id: string;
  name: string;
  node: string;
  file: string;
}

export const FIGURE_FILE = "regional_male.glb";

export const STUDIED_LIMIT = 16;

/**
 * Extracts all anatomical identifiers associated with a study session, combining
 * explicitly selected nodes with references tagged as [[organ_id]] in dialogue text.
 */
export function studiedIds(
  selectedIds: readonly string[],
  dialogueTexts: readonly string[],
  isRecognized: (identifier: string) => boolean,
): string[] {
  const result: string[] = [...selectedIds];

  for (const message of dialogueTexts) {
    const references = collectOrganRefs(message, isRecognized);
    for (const ref of references) {
      result.push(ref.organId);
    }
  }

  return result;
}

/**
 * Resolves anatomical IDs to their 3D scene mesh files and node targets for hologram illumination.
 * Excludes duplicates, unrecognized structures, and base whole-body avatar geometry.
 */
export function studiedOrgans(
  organIdentifiers: readonly string[],
  manifestCatalog: readonly ManifestOrgan[],
  capacity = STUDIED_LIMIT,
): StudiedOrgan[] {
  const catalogMap = new Map<string, ManifestOrgan>();
  for (const organ of manifestCatalog) {
    catalogMap.set(organ.organ_id, organ);
  }

  const resolved: StudiedOrgan[] = [];
  const processed = new Set<string>();

  for (const identifier of organIdentifiers) {
    if (resolved.length >= capacity) {
      break;
    }
    if (processed.has(identifier)) {
      continue;
    }
    processed.add(identifier);

    const organRecord = catalogMap.get(identifier);
    if (!organRecord || organRecord.mesh_file === FIGURE_FILE) {
      continue;
    }

    resolved.push({
      id: identifier,
      name: organRecord.name_en,
      node: organRecord.node,
      file: organRecord.mesh_file,
    });
  }

  return resolved;
}

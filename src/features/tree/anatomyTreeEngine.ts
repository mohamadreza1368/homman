/**
 * Hoomaan Anatomy Hierarchy & Bilingual Search Engine
 *
 * Implements BFS tree descent, ancestry chain resolution, and Persian/Arabic
 * text normalization for multi-language anatomical discovery.
 * Derived from specs/anatomy-hierarchy-search.md.
 */

export interface AnatomyNodeRecord {
  id: string;
  nameFa: string;
  nameLatin: string;
  nameEn: string;
  parentId?: string;
  childIds: string[];
  isLeaf: boolean;
}

/**
 * Normalizes Persian and Arabic text variations:
 * Unifies Arabic Yeh (ي/ى) with Persian Yeh (ی), Arabic Kaf (ك) with Persian Kaf (ک),
 * removes diacritics (Harakat) and non-breaking space variations.
 */
export function normalizeSearchTerm(input: string): string {
  if (!input) return "";

  return input
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "") // Diacritics
    .replace(/[\u064A\u0649]/g, "\u06CC") // Arabic Yeh -> Persian Yeh
    .replace(/\u0643/g, "\u06A9") // Arabic Kaf -> Persian Kaf
    .replace(/[\u200C\u200B]/g, " ") // Zero-width spaces to space
    .replace(/\s+/g, " ");
}

/**
 * Performs Breadth-First Search (BFS) starting from a parent node to collect
 * all descendant leaf structures in level-by-level topological order.
 */
export function collectDescendantLeaves(
  rootId: string,
  nodeLookup: ReadonlyMap<string, AnatomyNodeRecord>,
): string[] {
  const root = nodeLookup.get(rootId);
  if (!root) return [];
  if (root.isLeaf) return [root.id];

  const leaves: string[] = [];
  const queue: string[] = [...root.childIds];
  const visited = new Set<string>([rootId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodeLookup.get(currentId);
    if (!node) continue;

    if (node.isLeaf) {
      leaves.push(node.id);
    } else {
      for (const childId of node.childIds) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  return leaves;
}

/**
 * Resolves the path of identifiers from the root down to the target node.
 */
export function traceAncestryPath(
  targetId: string,
  nodeLookup: ReadonlyMap<string, AnatomyNodeRecord>,
): string[] {
  const path: string[] = [];
  let current: AnatomyNodeRecord | undefined = nodeLookup.get(targetId);
  const cycleDetector = new Set<string>();

  while (current && !cycleDetector.has(current.id)) {
    path.unshift(current.id);
    cycleDetector.add(current.id);
    current = current.parentId ? nodeLookup.get(current.parentId) : undefined;
  }

  return path;
}

export interface SearchMatchResult {
  node: AnatomyNodeRecord;
  matchedOn: "fa" | "latin" | "en";
}

/**
 * Searches across Persian, Latin, and English names with normalized matching.
 */
export function searchAnatomyNodes(
  query: string,
  nodes: readonly AnatomyNodeRecord[],
): SearchMatchResult[] {
  const cleanQuery = normalizeSearchTerm(query);
  if (!cleanQuery) return [];

  const results: SearchMatchResult[] = [];

  for (const node of nodes) {
    const cleanFa = normalizeSearchTerm(node.nameFa);
    if (cleanFa.includes(cleanQuery)) {
      results.push({ node, matchedOn: "fa" });
      continue;
    }

    const cleanLatin = normalizeSearchTerm(node.nameLatin);
    if (cleanLatin.includes(cleanQuery)) {
      results.push({ node, matchedOn: "latin" });
      continue;
    }

    const cleanEn = normalizeSearchTerm(node.nameEn);
    if (cleanEn.includes(cleanQuery)) {
      results.push({ node, matchedOn: "en" });
    }
  }

  return results;
}

/**
 * Hierarchical Anatomy Tree Builder
 *
 * Transforms flat collections of ManifestOrgan records into collapsible,
 * multi-level nested folder trees using each organ's path segments.
 */

import type { ManifestOrgan } from "@/lib/schemas";
import { organLabel } from "@/stores/sceneStore";

export interface TreeFolderNode {
  key: string;
  label: string;
  depth: number;
  subfolders: TreeFolderNode[];
  leafOrgans: ManifestOrgan[];
  totalOrganCount: number;
}

interface MutableNode {
  key: string;
  label: string;
  depth: number;
  children: Map<string, MutableNode>;
  organs: ManifestOrgan[];
}

/**
 * Builds a hierarchical tree from a flat array of organs based on their path arrays.
 * @param organs Flat list of organs
 * @param pathStartIndex Starting index in organ.path (e.g., skip root if already grouped)
 */
export function buildHierarchyTree(
  organs: ManifestOrgan[],
  pathStartIndex = 0,
): TreeFolderNode {
  const rootNode: MutableNode = {
    key: "root",
    label: "Root",
    depth: 0,
    children: new Map(),
    organs: [],
  };

  for (const organ of organs) {
    const segments = organ.path && organ.path.length > pathStartIndex
      ? organ.path.slice(pathStartIndex)
      : [];

    let current = rootNode;
    let pathKey = "root";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!.trim();
      if (!segment) continue;

      pathKey += `/${segment}`;
      let child = current.children.get(segment);
      if (!child) {
        child = {
          key: pathKey,
          label: segment,
          depth: current.depth + 1,
          children: new Map(),
          organs: [],
        };
        current.children.set(segment, child);
      }
      current = child;
    }

    current.organs.push(organ);
  }

  function freezeNode(node: MutableNode): TreeFolderNode {
    const subfolders: TreeFolderNode[] = [];
    let count = node.organs.length;

    // Sort subfolder names
    const sortedChildKeys = [...node.children.keys()].sort((a, b) => a.localeCompare(b));
    for (const childKey of sortedChildKeys) {
      const childMutable = node.children.get(childKey)!;
      const frozenChild = freezeNode(childMutable);
      subfolders.push(frozenChild);
      count += frozenChild.totalOrganCount;
    }

    // Sort leaf organs alphabetically by label
    const sortedOrgans = [...node.organs].sort((a, b) =>
      organLabel(a).localeCompare(organLabel(b)),
    );

    return {
      key: node.key,
      label: node.label,
      depth: node.depth,
      subfolders,
      leafOrgans: sortedOrgans,
      totalOrganCount: count,
    };
  }

  return freezeNode(rootNode);
}

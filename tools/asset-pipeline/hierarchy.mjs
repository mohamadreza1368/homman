/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Hierarchy repair and anatomical taxonomy curation engine.
 *
 * Clean-room implementation based on specs/asset-pipeline-anatomical-hierarchy.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TAXONOMY_REGIONS = JSON.parse(
  readFileSync(join(SCRIPT_DIR, "hierarchy_nervous_paths.json"), "utf8"),
);

export const NERVOUS_PATHS = Object.freeze(
  Object.values(TAXONOMY_REGIONS).reduce((acc, region) => {
    for (const term of region.terms) {
      acc[term] = region.path;
    }
    return acc;
  }, {}),
);

export const TAXONOMY_HEADING_REPLACEMENTS = Object.freeze({
  Muscles: "Other muscles",
});

/**
 * Pipeline processor for anatomical taxonomy alignment, symmetry consensus, and taxonomic repairs.
 */
export class AnatomyHierarchyRepairPipeline {
  constructor(rules = NERVOUS_PATHS, renames = TAXONOMY_HEADING_REPLACEMENTS) {
    this.canonicalPathRules = rules;
    this.headingRenames = renames;
  }

  process(entities) {
    const unvisitedRules = new Set(Object.keys(this.canonicalPathRules));
    const unvisitedRenames = new Set(Object.keys(this.headingRenames));

    let correctionCount = 0;
    let propagationCount = 0;
    let renameCount = 0;

    const deepestLineageByTerm = new Map();
    const workingEntities = [];

    // Stage 1: Curated nervous lineage alignment and depth registration
    for (const item of entities) {
      const record = { ...item, path: Array.isArray(item.path) ? [...item.path] : [] };

      if (record.system === "nervous") {
        const canonical = this.canonicalPathRules[record.ta2_latin];
        if (canonical) {
          record.path = [...canonical];
          unvisitedRules.delete(record.ta2_latin);
          correctionCount++;
        }

        const currentBest = deepestLineageByTerm.get(record.ta2_latin);
        if (!currentBest || record.path.length > currentBest.length) {
          deepestLineageByTerm.set(record.ta2_latin, record.path);
        }
      }

      workingEntities.push(record);
    }

    // Safety audit: Check for dangling unused path rules
    if (unvisitedRules.size > 0) {
      const missingList = Array.from(unvisitedRules).sort().join(", ");
      throw new Error(
        `NERVOUS_PATHS has entries matching no structure: ${missingList}. If the vendored hierarchy was fixed upstream, delete them.`,
      );
    }

    // Stage 2: Bilateral symmetry depth propagation and heading substitutions
    const finalized = workingEntities.map((item) => {
      let currentPath = item.path;

      if (item.system === "nervous") {
        const deepest = deepestLineageByTerm.get(item.ta2_latin);
        if (deepest && deepest.length > currentPath.length) {
          currentPath = [...deepest];
          propagationCount++;
        }
      }

      let renamed = false;
      const transformedPath = currentPath.map((node) => {
        const replacement = this.headingRenames[node];
        if (replacement !== undefined) {
          unvisitedRenames.delete(node);
          renamed = true;
          return replacement;
        }
        return node;
      });

      if (renamed) {
        renameCount++;
      }

      return { ...item, path: transformedPath };
    });

    // Safety audit: Check for dangling unused heading rename rules
    if (unvisitedRenames.size > 0) {
      const missingRenames = Array.from(unvisitedRenames).sort().join(", ");
      throw new Error(
        `HEADING_RENAMES has entries matching no heading: ${missingRenames}. If the upstream naming changed, delete them rather than leave them looking authoritative.`,
      );
    }

    return {
      organs: finalized,
      corrected: correctionCount,
      propagated: propagationCount,
      renamed: renameCount,
    };
  }
}

/**
 * Curates organ hierarchy paths, resolving brain subdivisions and paired symmetry.
 * @param {Array<object>} organEntities
 * @returns {{ organs: Array<object>, corrected: number, propagated: number, renamed: number }}
 */
export function repairHierarchy(organEntities) {
  return new AnatomyHierarchyRepairPipeline().process(organEntities);
}

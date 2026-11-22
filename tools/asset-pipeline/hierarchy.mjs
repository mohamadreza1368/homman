/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Taxonomy Curation Engine for Anatomical Lineages.
 *
 * Clean-room implementation designed from specs/asset-pipeline-anatomical-hierarchy.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const TAXONOMY_REGIONS = JSON.parse(
  readFileSync(join(CURRENT_DIR, "hierarchy_nervous_paths.json"), "utf8"),
);

export const TAXONOMY_PATH_OVERRIDES = Object.freeze(
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
 * Curation engine that resolves anatomical branches, unifies twin organ lineages,
 * and normalizes taxonomy headings.
 */
export class TaxonomyCurationEngine {
  constructor(
    pathOverrides = TAXONOMY_PATH_OVERRIDES,
    headingRenames = TAXONOMY_HEADING_REPLACEMENTS,
  ) {
    this.pathOverrides = pathOverrides;
    this.headingRenames = headingRenames;
  }

  /**
   * Curates an array of anatomical structure entities.
   * @param {Array<object>} structures
   * @returns {{ organs: Array<object>, corrected: number, propagated: number, renamed: number }}
   */
  curateOrganTaxonomy(structures) {
    const remainingOverrides = new Set(Object.keys(this.pathOverrides));
    const remainingRenames = new Set(Object.keys(this.headingRenames));

    let pathOverridesCount = 0;
    let twinDepthHarmonizedCount = 0;
    let renamedHeadingsCount = 0;

    const deepestLineageByTerm = new Map();
    const curatedList = [];

    // Stage 1: Lineage overrides for nervous system & depth discovery
    for (const item of structures) {
      const record = { ...item, path: Array.isArray(item.path) ? [...item.path] : [] };

      if (record.system === "nervous") {
        const canonical = this.pathOverrides[record.ta2_latin];
        if (canonical) {
          record.path = [...canonical];
          remainingOverrides.delete(record.ta2_latin);
          pathOverridesCount++;
        }

        const knownDeepest = deepestLineageByTerm.get(record.ta2_latin);
        if (!knownDeepest || record.path.length > knownDeepest.length) {
          deepestLineageByTerm.set(record.ta2_latin, record.path);
        }
      }

      curatedList.push(record);
    }

    // Integrity constraint: No stale or unused path override rules
    if (remainingOverrides.size > 0) {
      const unusedList = Array.from(remainingOverrides).sort().join(", ");
      throw new Error(
        `NERVOUS_PATHS has entries matching no structure: ${unusedList}. If the vendored hierarchy was fixed upstream, delete them.`,
      );
    }

    // Stage 2: Bilateral symmetry consensus & heading substitutions
    const finalized = curatedList.map((record) => {
      let activePath = record.path;

      if (record.system === "nervous") {
        const maximalDepthPath = deepestLineageByTerm.get(record.ta2_latin);
        if (maximalDepthPath && maximalDepthPath.length > activePath.length) {
          activePath = [...maximalDepthPath];
          twinDepthHarmonizedCount++;
        }
      }

      let hadRename = false;
      const substitutedPath = activePath.map((node) => {
        const replacement = this.headingRenames[node];
        if (replacement !== undefined) {
          remainingRenames.delete(node);
          hadRename = true;
          return replacement;
        }
        return node;
      });

      if (hadRename) {
        renamedHeadingsCount++;
      }

      return { ...record, path: substitutedPath };
    });

    // Integrity constraint: No stale or unused heading rename rules
    if (remainingRenames.size > 0) {
      const unusedRenames = Array.from(remainingRenames).sort().join(", ");
      throw new Error(
        `HEADING_RENAMES has entries matching no heading: ${unusedRenames}. If the upstream naming changed, delete them rather than leave them looking authoritative.`,
      );
    }

    return {
      organs: finalized,
      corrected: pathOverridesCount,
      propagated: twinDepthHarmonizedCount,
      renamed: renamedHeadingsCount,
    };
  }
}

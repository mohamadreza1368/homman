/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Module: Anatomical Taxonomy Tree Harmonization
 *
 * Designed from specs/asset-pipeline-anatomical-hierarchy.md.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const HIERARCHY_FILE = join(SCRIPT_DIR, "hierarchy_nervous_paths.json");

function loadNervousPathRules() {
  const fileData = JSON.parse(readFileSync(HIERARCHY_FILE, "utf8"));
  const mapping = {};
  for (const group of Object.values(fileData)) {
    if (group && Array.isArray(group.terms) && Array.isArray(group.path)) {
      for (const term of group.terms) {
        mapping[term] = group.path;
      }
    }
  }
  return mapping;
}

export const TAXONOMY_PATH_OVERRIDES = Object.freeze(loadNervousPathRules());

export const TAXONOMY_HEADING_REPLACEMENTS = Object.freeze({
  Muscles: "Other muscles",
});

/**
 * Harmonizer that restructures anatomical branches, propagates maximal twin depth,
 * and normalizes ambiguous taxonomy headers.
 */
export class TaxonomyTreeHarmonizer {
  constructor(
    pathOverrides = TAXONOMY_PATH_OVERRIDES,
    headingRenames = TAXONOMY_HEADING_REPLACEMENTS,
  ) {
    this.pathOverrides = pathOverrides;
    this.headingRenames = headingRenames;
  }

  /**
   * Processes an array of anatomical nodes according to specification rules.
   * @template T
   * @param {readonly T[]} items
   * @returns {{ organs: T[], corrected: number, propagated: number, renamed: number }}
   */
  harmonize(items) {
    const pendingOverrides = new Set(Object.keys(this.pathOverrides));
    const pendingRenames = new Set(Object.keys(this.headingRenames));

    let countPathOverrides = 0;
    let countPropagatedTwins = 0;
    let countRenamedHeadings = 0;

    // Track the deepest path observed for each Latin structure in nervous system
    const maximalPaths = new Map();
    const intermediateList = [];

    // Pass 1: Apply path overrides & observe deepest path per structure
    for (const item of items) {
      const cloned = { ...item, path: Array.isArray(item.path) ? [...item.path] : [] };

      if (cloned.system === "nervous") {
        const customPath = this.pathOverrides[cloned.ta2_latin];
        if (customPath) {
          cloned.path = [...customPath];
          pendingOverrides.delete(cloned.ta2_latin);
          countPathOverrides++;
        }

        const currentDeepest = maximalPaths.get(cloned.ta2_latin);
        if (!currentDeepest || cloned.path.length > currentDeepest.length) {
          maximalPaths.set(cloned.ta2_latin, cloned.path);
        }
      }

      intermediateList.push(cloned);
    }

    // Fail early if any configured path override was never matched
    if (pendingOverrides.size > 0) {
      const unmatched = Array.from(pendingOverrides).sort().join(", ");
      throw new Error(
        `NERVOUS_PATHS has entries matching no structure: ${unmatched}. If the vendored hierarchy was fixed upstream, delete them.`,
      );
    }

    // Pass 2: Bilateral consensus propagation & heading substitutions
    const finalized = intermediateList.map((item) => {
      let activeLineage = item.path;

      if (item.system === "nervous") {
        const consensusLineage = maximalPaths.get(item.ta2_latin);
        if (consensusLineage && consensusLineage.length > activeLineage.length) {
          activeLineage = [...consensusLineage];
          countPropagatedTwins++;
        }
      }

      let hadSubstitution = false;
      const updatedLineage = activeLineage.map((segment) => {
        const replacement = this.headingRenames[segment];
        if (replacement) {
          pendingRenames.delete(segment);
          hadSubstitution = true;
          return replacement;
        }
        return segment;
      });

      if (hadSubstitution) {
        countRenamedHeadings++;
      }

      return {
        ...item,
        path: updatedLineage,
      };
    });

    // Fail early if any heading rename rule was never matched
    if (pendingRenames.size > 0) {
      const unmatchedHeadings = Array.from(pendingRenames).sort().join(", ");
      throw new Error(
        `HEADING_RENAMES has entries matching no heading: ${unmatchedHeadings}. If the vendored hierarchy was fixed upstream, delete them.`,
      );
    }

    return {
      organs: finalized,
      corrected: countPathOverrides,
      propagated: countPropagatedTwins,
      renamed: countRenamedHeadings,
    };
  }

  // Alias for backward compatibility
  curateOrganTaxonomy(items) {
    return this.harmonize(items);
  }
}

// Ergonomic alias
export const TaxonomyCurationEngine = TaxonomyTreeHarmonizer;

/**
 * Hoomaan 3D Anatomy Platform - Asset Pipeline
 * Hierarchy repair and anatomical taxonomy curation engine.
 * Ensures anatomical structures (particularly CNS and cranial nerves) map to canonical subdivisions.
 */

const TAXONOMY_REGIONS = [
  {
    path: ["Central nervous system", "Brain", "Cerebrum", "Telencephalon"],
    terms: [
      "Corpus callosum",
      "Commissura anterior",
      "Commissura hippocampi",
      "Fornix",
      "Septum pellucidum",
      "Nuclei septales",
      "Hippocampus",
      "Corpus amygdaloideum",
      "Nucleus caudatus",
      "Putamen",
      "Globus pallidus",
      "Nucleus lentiformis",
      "Stria terminalis",
    ],
  },
  {
    path: ["Central nervous system", "Brain", "Diencephalon"],
    terms: [
      "Thalamus",
      "Hypothalamus",
      "Corpus mammillare",
      "Habenula",
      "Stria medullaris thalami",
      "Commissura posterior",
      "Corpus geniculatum laterale",
      "Corpus geniculatum mediale",
      "Chiasma opticum",
      "Tractus opticus",
    ],
  },
  {
    path: ["Central nervous system", "Brain", "Brainstem", "Mesencephalon"],
    terms: [
      "Mesencephalon",
      "Aquaeductus mesencephali",
      "Colliculus superior",
      "Colliculus inferior",
      "Nucleus ruber",
      "Basis pedunculi",
      "Fossa interpeduncularis",
      "Nucleus nervi oculomotorius",
      "Nucleus accessorius nervi oculomotorii",
      "Nucleus nervi trochlearis",
    ],
  },
  {
    path: ["Central nervous system", "Brain", "Brainstem", "Pons"],
    terms: [
      "Pons",
      "Nucleus nervi abducentis",
      "Nucleus nervi facialis",
      "Nucleus salivatorius superior",
    ],
  },
  {
    path: ["Central nervous system", "Brain", "Brainstem", "Medulla oblongata"],
    terms: [
      "Medulla oblongata",
      "Oliva",
      "Pyramis medullae oblongatae",
      "Nucleus ambiguus",
      "Nucleus nervi hypoglossi",
      "Nucleus posterior nervi vagi",
      "Nucleus tractus solitarii",
      "Nucleus salivatorius inferior",
    ],
  },
  {
    path: ["Central nervous system", "Brain", "Brainstem"],
    terms: [
      "Nuclei vestibulares",
      "Nucleus cochlearis anterior",
      "Nucleus cochlearis posterior",
      "Nucleus nervi accessorii",
    ],
  },
  {
    path: ["Central nervous system", "Brain", "Ventricular system"],
    terms: [
      "Ventriculus lateralis",
      "Ventriculus tertius",
      "Ventriculus quartus",
      "Plexus chorioideus",
    ],
  },
  {
    path: ["Central nervous system", "Meninges"],
    terms: ["Falx cerebri", "Tentorium cerebelli", "Dura spinalis"],
  },
  {
    path: ["Central nervous system", "Spinal cord"],
    terms: [
      "Canalis centralis",
      "Cornu anterius medullae spinalis",
      "Cornu posterius medullae spinalis",
      "Substantia alba medullae spinalis",
      "Substantia intermedia lateralis",
      "Nucleus intermediolateralis",
      "Nucleus intermediomedialis",
      "Nucleus proprius",
      "Processus reticularis spinalis",
      "Fasciculus gracilis",
      "Fasciculus cuneatus",
      "Fasciculus posterolateralis",
      "Fasciculus proprius anterior",
      "Fasciculus proprius lateralis",
      "Fasciculus proprius posterior",
      "Tractus corticospinalis anterior",
      "Tractus corticospinalis lateralis",
      "Tractus reticulospinalis lateralis",
      "Tractus reticulospinalis medialis",
      "Tractus rubrospinalis",
      "Tractus spinocerebellaris anterior",
      "Tractus spinocerebellaris posterior",
      "Tractus spinotectalis",
      "Tractus spinothalamicus anterior",
      "Tractus spinothalamicus lateralis",
      "Tractus tectospinalis",
      "Tractus vestibulospinalis lateralis",
      "Tractus vestibulospinalis medialis",
      "Cauda equina",
      "Radix anterior nervi spinalis",
      "Radix posterior nervi spinalis",
    ],
  },
  {
    path: ["Peripheral nervous system"],
    terms: ["Ganglion spinale"],
  },
  {
    path: ["Peripheral nervous system", "Nerves"],
    terms: ["Nervus musculi quadrati femoris"],
  },
  {
    path: ["Sense organs", "Eyeball"],
    terms: [
      "Camera anterior bulbi oculi",
      "Cornea",
      "Corpus vitreum",
      "Fibrae zonulares",
      "Iris",
      "Lens",
      "Retina",
      "Sclera",
      "Segmentum anterius bulbi oculi",
      "Segmentum posterius bulbi oculi",
    ],
  },
  {
    path: ["Sense organs"],
    terms: ["Tuba auditiva"],
  },
];

export const NERVOUS_PATHS = Object.freeze(
  TAXONOMY_REGIONS.reduce((acc, region) => {
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
    const untouchedRules = new Set(Object.keys(this.canonicalPathRules));
    const untouchedRenames = new Set(Object.keys(this.headingRenames));

    let correctionCount = 0;
    let propagationCount = 0;
    let renameCount = 0;

    const deepestLineageByTerm = new Map();
    const stagedEntities = [];

    // Phase 1: Curated path application and maximal depth discovery
    for (const item of entities) {
      const clone = { ...item, path: Array.isArray(item.path) ? [...item.path] : [] };

      if (clone.system === "nervous") {
        const canonical = this.canonicalPathRules[clone.ta2_latin];
        if (canonical) {
          clone.path = [...canonical];
          untouchedRules.delete(clone.ta2_latin);
          correctionCount++;
        }

        const prevBest = deepestLineageByTerm.get(clone.ta2_latin);
        if (!prevBest || clone.path.length > prevBest.length) {
          deepestLineageByTerm.set(clone.ta2_latin, clone.path);
        }
      }

      stagedEntities.push(clone);
    }

    if (untouchedRules.size > 0) {
      const missing = Array.from(untouchedRules).sort().join(", ");
      throw new Error(
        `NERVOUS_PATHS has entries matching no structure: ${missing}. If the vendored hierarchy was fixed upstream, delete them.`,
      );
    }

    // Phase 2: Symmetry depth propagation and heading substitutions
    const finalized = stagedEntities.map((item) => {
      let currentPath = item.path;

      if (item.system === "nervous") {
        const deepest = deepestLineageByTerm.get(item.ta2_latin);
        if (deepest && deepest.length > currentPath.length) {
          currentPath = [...deepest];
          propagationCount++;
        }
      }

      let altered = false;
      const renamedPath = currentPath.map((node) => {
        const replacement = this.headingRenames[node];
        if (replacement !== undefined) {
          untouchedRenames.delete(node);
          altered = true;
          return replacement;
        }
        return node;
      });

      if (altered) {
        renameCount++;
      }

      return { ...item, path: renamedPath };
    });

    if (untouchedRenames.size > 0) {
      const missing = Array.from(untouchedRenames).sort().join(", ");
      throw new Error(
        `HEADING_RENAMES has entries matching no heading: ${missing}. If the upstream naming changed, delete them rather than leave them looking authoritative.`,
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
  const pipeline = new AnatomyHierarchyRepairPipeline();
  return pipeline.process(organEntities);
}

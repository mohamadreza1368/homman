/**
 * Hoomaan Asset Pipeline - Anatomical Tree Hierarchy Curation
 */

const P_CNS = ["Central nervous system"];
const P_BRAIN = [...P_CNS, "Brain"];
const P_TELEN = [...P_BRAIN, "Cerebrum", "Telencephalon"];
const P_DIEN = [...P_BRAIN, "Diencephalon"];
const P_STEM = [...P_BRAIN, "Brainstem"];
const P_MID = [...P_STEM, "Mesencephalon"];
const P_PONS = [...P_STEM, "Pons"];
const P_MEDULLA = [...P_STEM, "Medulla oblongata"];
const P_VENTRICLES = [...P_BRAIN, "Ventricular system"];
const P_CORD = [...P_CNS, "Spinal cord"];
const P_MENINGES = [...P_CNS, "Meninges"];
const P_PNS = ["Peripheral nervous system"];
const P_SENSE = ["Sense organs"];
const P_EYE = [...P_SENSE, "Eyeball"];

export const NERVOUS_PATHS = {
  "Corpus callosum": P_TELEN,
  "Commissura anterior": P_TELEN,
  "Commissura hippocampi": P_TELEN,
  Fornix: P_TELEN,
  "Septum pellucidum": P_TELEN,
  "Nuclei septales": P_TELEN,
  Hippocampus: P_TELEN,
  "Corpus amygdaloideum": P_TELEN,
  "Nucleus caudatus": P_TELEN,
  Putamen: P_TELEN,
  "Globus pallidus": P_TELEN,
  "Nucleus lentiformis": P_TELEN,
  "Stria terminalis": P_TELEN,
  Thalamus: P_DIEN,
  Hypothalamus: P_DIEN,
  "Corpus mammillare": P_DIEN,
  Habenula: P_DIEN,
  "Stria medullaris thalami": P_DIEN,
  "Commissura posterior": P_DIEN,
  "Corpus geniculatum laterale": P_DIEN,
  "Corpus geniculatum mediale": P_DIEN,
  "Chiasma opticum": P_DIEN,
  "Tractus opticus": P_DIEN,
  Mesencephalon: P_MID,
  "Aquaeductus mesencephali": P_MID,
  "Colliculus superior": P_MID,
  "Colliculus inferior": P_MID,
  "Nucleus ruber": P_MID,
  "Basis pedunculi": P_MID,
  "Fossa interpeduncularis": P_MID,
  "Nucleus nervi oculomotorius": P_MID,
  "Nucleus accessorius nervi oculomotorii": P_MID,
  "Nucleus nervi trochlearis": P_MID,
  Pons: P_PONS,
  "Nucleus nervi abducentis": P_PONS,
  "Nucleus nervi facialis": P_PONS,
  "Nucleus salivatorius superior": P_PONS,
  "Medulla oblongata": P_MEDULLA,
  Oliva: P_MEDULLA,
  "Pyramis medullae oblongatae": P_MEDULLA,
  "Nucleus ambiguus": P_MEDULLA,
  "Nucleus nervi hypoglossi": P_MEDULLA,
  "Nucleus posterior nervi vagi": P_MEDULLA,
  "Nucleus tractus solitarii": P_MEDULLA,
  "Nucleus salivatorius inferior": P_MEDULLA,
  "Nuclei vestibulares": P_STEM,
  "Nucleus cochlearis anterior": P_STEM,
  "Nucleus cochlearis posterior": P_STEM,
  "Nucleus nervi accessorii": P_STEM,
  "Ventriculus lateralis": P_VENTRICLES,
  "Ventriculus tertius": P_VENTRICLES,
  "Ventriculus quartus": P_VENTRICLES,
  "Plexus chorioideus": P_VENTRICLES,
  "Falx cerebri": P_MENINGES,
  "Tentorium cerebelli": P_MENINGES,
  "Dura spinalis": P_MENINGES,
  "Canalis centralis": P_CORD,
  "Cornu anterius medullae spinalis": P_CORD,
  "Cornu posterius medullae spinalis": P_CORD,
  "Substantia alba medullae spinalis": P_CORD,
  "Substantia intermedia lateralis": P_CORD,
  "Nucleus intermediolateralis": P_CORD,
  "Nucleus intermediomedialis": P_CORD,
  "Nucleus proprius": P_CORD,
  "Processus reticularis spinalis": P_CORD,
  "Fasciculus gracilis": P_CORD,
  "Fasciculus cuneatus": P_CORD,
  "Fasciculus posterolateralis": P_CORD,
  "Fasciculus proprius anterior": P_CORD,
  "Fasciculus proprius lateralis": P_CORD,
  "Fasciculus proprius posterior": P_CORD,
  "Tractus corticospinalis anterior": P_CORD,
  "Tractus corticospinalis lateralis": P_CORD,
  "Tractus reticulospinalis lateralis": P_CORD,
  "Tractus reticulospinalis medialis": P_CORD,
  "Tractus rubrospinalis": P_CORD,
  "Tractus spinocerebellaris anterior": P_CORD,
  "Tractus spinocerebellaris posterior": P_CORD,
  "Tractus spinotectalis": P_CORD,
  "Tractus spinothalamicus anterior": P_CORD,
  "Tractus spinothalamicus lateralis": P_CORD,
  "Tractus tectospinalis": P_CORD,
  "Tractus vestibulospinalis lateralis": P_CORD,
  "Tractus vestibulospinalis medialis": P_CORD,
  "Cauda equina": P_CORD,
  "Radix anterior nervi spinalis": P_CORD,
  "Radix posterior nervi spinalis": P_CORD,
  "Ganglion spinale": P_PNS,
  "Nervus musculi quadrati femoris": [...P_PNS, "Nerves"],
  "Camera anterior bulbi oculi": P_EYE,
  Cornea: P_EYE,
  "Corpus vitreum": P_EYE,
  "Fibrae zonulares": P_EYE,
  Iris: P_EYE,
  Lens: P_EYE,
  Retina: P_EYE,
  Sclera: P_EYE,
  "Segmentum anterius bulbi oculi": P_EYE,
  "Segmentum posterius bulbi oculi": P_EYE,
  "Tuba auditiva": P_SENSE,
};

const LABEL_REWRITES = {
  Muscles: "Other muscles",
};

export function repairHierarchy(organEntries) {
  const pendingTerms = new Set(Object.keys(NERVOUS_PATHS));
  let countCorrected = 0;

  const pass1 = organEntries.map((entity) => {
    if (entity.system !== "nervous") return entity;
    const curatedPath = NERVOUS_PATHS[entity.ta2_latin];
    if (!curatedPath) return entity;
    pendingTerms.delete(entity.ta2_latin);
    countCorrected += 1;
    return { ...entity, path: [...curatedPath] };
  });

  if (pendingTerms.size > 0) {
    throw new Error(
      `NERVOUS_PATHS has entries matching no structure: ${[...pendingTerms].join(", ")}. If the vendored hierarchy was fixed upstream, delete them.`,
    );
  }

  const maximalAncestry = new Map();
  for (const entity of pass1) {
    if (entity.system !== "nervous") continue;
    const currentBest = maximalAncestry.get(entity.ta2_latin);
    if (!currentBest || entity.path.length > currentBest.length) {
      maximalAncestry.set(entity.ta2_latin, entity.path);
    }
  }

  let countPropagated = 0;
  const pass2 = pass1.map((entity) => {
    if (entity.system !== "nervous") return entity;
    const targetAncestry = maximalAncestry.get(entity.ta2_latin);
    if (!targetAncestry || targetAncestry.length <= entity.path.length) return entity;
    countPropagated += 1;
    return { ...entity, path: [...targetAncestry] };
  });

  const pendingRewrites = new Set(Object.keys(LABEL_REWRITES));
  let countRenamed = 0;
  const finalOrganList = pass2.map((entity) => {
    const requiresRewrite = entity.path.some((step) => step in LABEL_REWRITES);
    if (!requiresRewrite) return entity;
    countRenamed += 1;
    return {
      ...entity,
      path: entity.path.map((step) => {
        if (step in LABEL_REWRITES) pendingRewrites.delete(step);
        return LABEL_REWRITES[step] ?? step;
      }),
    };
  });

  if (pendingRewrites.size > 0) {
    throw new Error(
      `HEADING_RENAMES has entries matching no heading: ${[...pendingRewrites].join(", ")}. If the upstream naming changed, delete them rather than leave them looking authoritative.`,
    );
  }

  return {
    organs: finalOrganList,
    corrected: countCorrected,
    propagated: countPropagated,
    renamed: countRenamed,
  };
}

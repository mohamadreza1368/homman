/**
 * Complete Medical Ontology Mapping Engine (TA2 · FMA · UBERON · SNOMED CT · HL7 FHIR)
 *
 * Bridges Z-Anatomy / TA2 organ identifiers to standard biomedical ontologies
 * (Foundational Model of Anatomy, Uber-anatomy Ontology, SNOMED CT) and
 * generates HL7 FHIR BodyStructure resources for clinical AI & EHR interoperability.
 */

import type { AnatomicalSystem, GenderModel, ManifestOrgan } from "@/lib/schemas";

export interface OntologyMapping {
  ta2: string;
  uberon: string;
  uberonLabel: string;
  fma: string;
  snomed?: string;
  precision: "exact" | "class";
}

interface ExactOntologyRule {
  pattern: RegExp;
  uberon: string;
  uberonLabel: string;
  fma: string;
  snomed?: string;
}

const EXACT_ONTOLOGY_RULES: ExactOntologyRule[] = [
  // Cardiovascular & Heart
  { pattern: /^right_atrium$/i, uberon: "UBERON:0002078", uberonLabel: "right cardiac atrium", fma: "FMA:7096", snomed: "73829009" },
  { pattern: /^left_atrium$/i, uberon: "UBERON:0002079", uberonLabel: "left cardiac atrium", fma: "FMA:7097", snomed: "82471001" },
  { pattern: /^right_ventricle$/i, uberon: "UBERON:0002080", uberonLabel: "right ventricle", fma: "FMA:7098", snomed: "53085002" },
  { pattern: /^left_ventricle$/i, uberon: "UBERON:0002084", uberonLabel: "left ventricle", fma: "FMA:7101", snomed: "87878005" },
  { pattern: /^ascending_aorta$/i, uberon: "UBERON:0001496", uberonLabel: "ascending aorta", fma: "FMA:3736", snomed: "54247002" },
  { pattern: /^thoracic_aorta$/i, uberon: "UBERON:0001515", uberonLabel: "thoracic aorta", fma: "FMA:3789", snomed: "113262008" },
  { pattern: /^abdominal_aorta$/i, uberon: "UBERON:0001516", uberonLabel: "abdominal aorta", fma: "FMA:3788", snomed: "7832008" },
  { pattern: /^pulmonary_trunk$/i, uberon: "UBERON:0001514", uberonLabel: "pulmonary trunk", fma: "FMA:8615", snomed: "45341000" },
  { pattern: /^superior_vena_cava$/i, uberon: "UBERON:0001514", uberonLabel: "superior vena cava", fma: "FMA:4720", snomed: "48345005" },
  { pattern: /^inferior_vena_cava/i, uberon: "UBERON:0001072", uberonLabel: "inferior vena cava", fma: "FMA:10951", snomed: "64131007" },
  { pattern: /common_carotid_artery/i, uberon: "UBERON:0001530", uberonLabel: "common carotid artery", fma: "FMA:3939", snomed: "32062004" },
  { pattern: /internal_jugular_vein/i, uberon: "UBERON:0001586", uberonLabel: "internal jugular vein", fma: "FMA:4724", snomed: "12123001" },
  { pattern: /femoral_artery/i, uberon: "UBERON:0001313", uberonLabel: "femoral artery", fma: "FMA:20740", snomed: "7657000" },
  { pattern: /femoral_vein/i, uberon: "UBERON:0001361", uberonLabel: "femoral vein", fma: "FMA:21185", snomed: "83419000" },
  { pattern: /brachial_artery/i, uberon: "UBERON:0001399", uberonLabel: "brachial artery", fma: "FMA:22689", snomed: "17137000" },
  { pattern: /radial_artery/i, uberon: "UBERON:0001406", uberonLabel: "radial artery", fma: "FMA:22730", snomed: "45631007" },
  { pattern: /popliteal_artery/i, uberon: "UBERON:0001371", uberonLabel: "popliteal artery", fma: "FMA:77155", snomed: "43899006" },
  { pattern: /hepatic_portal_vein/i, uberon: "UBERON:0002017", uberonLabel: "hepatic portal vein", fma: "FMA:14333", snomed: "32764006" },
  { pattern: /azygos_vein/i, uberon: "UBERON:0001634", uberonLabel: "azygos vein", fma: "FMA:4838", snomed: "72107004" },

  // Digestive
  { pattern: /^liver$/i, uberon: "UBERON:0002107", uberonLabel: "liver", fma: "FMA:7197", snomed: "10200004" },
  { pattern: /segment_of_liver/i, uberon: "UBERON:0001114", uberonLabel: "liver lobe/segment", fma: "FMA:13361", snomed: "41879009" },
  { pattern: /^gallbladder$/i, uberon: "UBERON:0002110", uberonLabel: "gallbladder", fma: "FMA:7202", snomed: "28231008" },
  { pattern: /^stomach$/i, uberon: "UBERON:0000945", uberonLabel: "stomach", fma: "FMA:7148", snomed: "69695003" },
  { pattern: /^mucosa_of_stomach$/i, uberon: "UBERON:0001199", uberonLabel: "gastric mucosa", fma: "FMA:14907", snomed: "7859005" },
  { pattern: /^duodenum$/i, uberon: "UBERON:0002114", uberonLabel: "duodenum", fma: "FMA:7206", snomed: "38848004" },
  { pattern: /^jejunum$/i, uberon: "UBERON:0002115", uberonLabel: "jejunum", fma: "FMA:7207", snomed: "21306003" },
  { pattern: /^ileum$/i, uberon: "UBERON:0002116", uberonLabel: "ileum", fma: "FMA:7208", snomed: "34516001" },
  { pattern: /^caecum$/i, uberon: "UBERON:0001153", uberonLabel: "caecum", fma: "FMA:14541", snomed: "32713005" },
  { pattern: /^ascending_colon$/i, uberon: "UBERON:0001156", uberonLabel: "ascending colon", fma: "FMA:14545", snomed: "9040008" },
  { pattern: /^transverse_colon$/i, uberon: "UBERON:0001157", uberonLabel: "transverse colon", fma: "FMA:14546", snomed: "485005" },
  { pattern: /^descending_colon$/i, uberon: "UBERON:0001158", uberonLabel: "descending colon", fma: "FMA:14547", snomed: "32622004" },
  { pattern: /^sigmoid_colon$/i, uberon: "UBERON:0001159", uberonLabel: "sigmoid colon", fma: "FMA:14548", snomed: "60184004" },
  { pattern: /^rectum$/i, uberon: "UBERON:0001052", uberonLabel: "rectum", fma: "FMA:14544", snomed: "34402009" },
  { pattern: /^pancreas$/i, uberon: "UBERON:0001264", uberonLabel: "pancreas", fma: "FMA:7198", snomed: "15776009" },
  { pattern: /esophag|oesophag/i, uberon: "UBERON:0001043", uberonLabel: "esophagus", fma: "FMA:7131", snomed: "32849002" },

  // Respiratory
  { pattern: /^trachea$/i, uberon: "UBERON:0003126", uberonLabel: "trachea", fma: "FMA:7394", snomed: "44567001" },
  { pattern: /^vocal_folds$/i, uberon: "UBERON:0001729", uberonLabel: "vocal fold", fma: "FMA:55415", snomed: "42973007" },
  { pattern: /superior_lobe_of_right_lung/i, uberon: "UBERON:0002170", uberonLabel: "right lung upper lobe", fma: "FMA:7333", snomed: "42400003" },
  { pattern: /middle_lobe_of_right_lung/i, uberon: "UBERON:0002174", uberonLabel: "right lung middle lobe", fma: "FMA:7337", snomed: "72481006" },
  { pattern: /inferior_lobe_of_right_lung/i, uberon: "UBERON:0002171", uberonLabel: "right lung lower lobe", fma: "FMA:7335", snomed: "266005" },
  { pattern: /superior_lobe_of_left_lung/i, uberon: "UBERON:0002168", uberonLabel: "left lung upper lobe", fma: "FMA:7370", snomed: "44714003" },
  { pattern: /inferior_lobe_of_left_lung/i, uberon: "UBERON:0002169", uberonLabel: "left lung lower lobe", fma: "FMA:7372", snomed: "41224006" },
  { pattern: /^pleura$/i, uberon: "UBERON:0000977", uberonLabel: "pleura", fma: "FMA:9583", snomed: "3120008" },
  { pattern: /thyroid_cartilage/i, uberon: "UBERON:0002374", uberonLabel: "thyroid cartilage", fma: "FMA:55099", snomed: "64164007" },
  { pattern: /cricoid_cartilage/i, uberon: "UBERON:0002375", uberonLabel: "cricoid cartilage", fma: "FMA:55100", snomed: "29457005" },

  // Renal & Endocrine
  { pattern: /^kidney_l$|^kidney_r$/i, uberon: "UBERON:0002113", uberonLabel: "kidney", fma: "FMA:7203", snomed: "64033007" },
  { pattern: /ureter/i, uberon: "UBERON:0000056", uberonLabel: "ureter", fma: "FMA:9704", snomed: "87953007" },
  { pattern: /^urinary_bladder$/i, uberon: "UBERON:0001255", uberonLabel: "urinary bladder", fma: "FMA:15900", snomed: "89837001" },
  { pattern: /^thyroid_gland$/i, uberon: "UBERON:0002046", uberonLabel: "thyroid gland", fma: "FMA:9603", snomed: "69748006" },
  { pattern: /suprarenal|adrenal/i, uberon: "UBERON:0002369", uberonLabel: "adrenal gland", fma: "FMA:9604", snomed: "23451007" },
  { pattern: /^spleen$/i, uberon: "UBERON:0002106", uberonLabel: "spleen", fma: "FMA:7196", snomed: "78961009" },
  { pattern: /^right_seminal_vesicle$/i, uberon: "UBERON:0000998", uberonLabel: "right seminal vesicle", fma: "FMA:19387", snomed: "64739004" },
  { pattern: /^left_seminal_vesicle$/i, uberon: "UBERON:0000998", uberonLabel: "left seminal vesicle", fma: "FMA:19388", snomed: "64739004" },
  { pattern: /^thoracic_duct$/i, uberon: "UBERON:0001631", uberonLabel: "thoracic duct", fma: "FMA:5031", snomed: "76738006" },

  // Nervous & Meninges
  { pattern: /spinal_dura/i, uberon: "UBERON:0002363", uberonLabel: "spinal dura mater", fma: "FMA:241247", snomed: "48824006" },
  { pattern: /falx_cerebri/i, uberon: "UBERON:0004684", uberonLabel: "falx cerebri", fma: "FMA:83945", snomed: "16051009" },
  { pattern: /tentorium_cerebelli/i, uberon: "UBERON:0004685", uberonLabel: "tentorium cerebelli", fma: "FMA:83946", snomed: "17360000" },
  { pattern: /spinal_cord/i, uberon: "UBERON:0002240", uberonLabel: "spinal cord", fma: "FMA:7647", snomed: "2748008" },
  { pattern: /vagus_nerve/i, uberon: "UBERON:0001759", uberonLabel: "vagus nerve (CN X)", fma: "FMA:5731", snomed: "88882009" },
  { pattern: /sciatic_nerve/i, uberon: "UBERON:0001322", uberonLabel: "sciatic nerve", fma: "FMA:19034", snomed: "59652004" },
  { pattern: /median_nerve/i, uberon: "UBERON:0001483", uberonLabel: "median nerve", fma: "FMA:14385", snomed: "33723005" },

  // Core Skeletal & Muscular
  { pattern: /^femur/i, uberon: "UBERON:0000981", uberonLabel: "femur", fma: "FMA:9611", snomed: "71341001" },
  { pattern: /^humerus/i, uberon: "UBERON:0000976", uberonLabel: "humerus", fma: "FMA:13303", snomed: "85050009" },
  { pattern: /^tibia/i, uberon: "UBERON:0000979", uberonLabel: "tibia", fma: "FMA:24476", snomed: "12611008" },
  { pattern: /^sternum|^body_of_sternum|^manubrium_of_sternum/i, uberon: "UBERON:0000975", uberonLabel: "sternum", fma: "FMA:7485", snomed: "56873002" },
  { pattern: /^biceps_brachii/i, uberon: "UBERON:0001507", uberonLabel: "biceps brachii", fma: "FMA:37670", snomed: "48528003" },
  { pattern: /^diaphragm/i, uberon: "UBERON:0001103", uberonLabel: "diaphragm", fma: "FMA:13295", snomed: "5798000" },
];

const SYSTEM_CLASS_FALLBACK: Record<
  AnatomicalSystem,
  { uberon: string; uberonLabel: string; fma: string; snomed: string }
> = {
  skeletal: { uberon: "UBERON:0001474", uberonLabel: "bone element", fma: "FMA:5018", snomed: "272673000" },
  articular: { uberon: "UBERON:0000982", uberonLabel: "skeletal joint", fma: "FMA:7490", snomed: "39352004" },
  muscular: { uberon: "UBERON:0001630", uberonLabel: "muscle organ", fma: "FMA:30316", snomed: "71616004" },
  nervous: { uberon: "UBERON:0001021", uberonLabel: "nerve / neural structure", fma: "FMA:65132", snomed: "84782009" },
  cardiovascular: { uberon: "UBERON:0001981", uberonLabel: "blood vessel", fma: "FMA:63183", snomed: "59820001" },
  respiratory: { uberon: "UBERON:0000065", uberonLabel: "respiratory tract", fma: "FMA:7158", snomed: "321667001" },
  digestive: { uberon: "UBERON:0001555", uberonLabel: "digestive tract organ", fma: "FMA:71132", snomed: "86762007" },
  renal: { uberon: "UBERON:0000055", uberonLabel: "renal / urinary organ", fma: "FMA:7159", snomed: "122489005" },
  endocrine: { uberon: "UBERON:0002368", uberonLabel: "endocrine gland", fma: "FMA:9602", snomed: "113331007" },
  reproductive: { uberon: "UBERON:0000990", uberonLabel: "reproductive organ", fma: "FMA:7160", snomed: "278877003" },
  lymphatic: { uberon: "UBERON:0000029", uberonLabel: "lymphatic structure", fma: "FMA:5034", snomed: "59441001" },
  integumentary: { uberon: "UBERON:0002416", uberonLabel: "integumental system", fma: "FMA:72979", snomed: "113345001" },
  regional: { uberon: "UBERON:0000475", uberonLabel: "organism subdivision", fma: "FMA:67509", snomed: "38866009" },
};

/**
 * Resolves a complete TA2 / UBERON / FMA / SNOMED CT ontology mapping for any ManifestOrgan.
 */
export function resolveOrganOntology(organ: Pick<ManifestOrgan, "organ_id" | "ta2_latin" | "system">): OntologyMapping {
  const exact = EXACT_ONTOLOGY_RULES.find((r) => r.pattern.test(organ.organ_id));
  if (exact) {
    return {
      ta2: organ.ta2_latin,
      uberon: exact.uberon,
      uberonLabel: exact.uberonLabel,
      fma: exact.fma,
      ...(exact.snomed ? { snomed: exact.snomed } : {}),
      precision: "exact",
    };
  }

  const cls = SYSTEM_CLASS_FALLBACK[organ.system] ?? SYSTEM_CLASS_FALLBACK.regional;
  return {
    ta2: organ.ta2_latin,
    uberon: cls.uberon,
    uberonLabel: cls.uberonLabel,
    fma: cls.fma,
    snomed: cls.snomed,
    precision: "class",
  };
}

/**
 * Generates a valid HL7 FHIR BodyStructure JSON representation for clinical EHR/AI integration.
 */
export function buildFhirBodyStructure(
  organ: Pick<ManifestOrgan, "organ_id" | "name_en" | "ta2_latin" | "system">,
  model: GenderModel,
) {
  const ont = resolveOrganOntology(organ);
  const laterality = organ.organ_id.endsWith("_l")
    ? { code: "7771000", display: "Left" }
    : organ.organ_id.endsWith("_r")
      ? { code: "24028007", display: "Right" }
      : null;

  return {
    resourceType: "BodyStructure",
    id: `hoomaan-${model}-${organ.organ_id}`,
    active: true,
    morphology: {
      coding: [
        { system: "http://snomed.info/sct", code: ont.snomed ?? "123037004", display: organ.name_en },
        { system: "http://purl.obolibrary.org/obo/uberon.owl", code: ont.uberon, display: ont.uberonLabel },
        { system: "http://purl.org/sig/ont/fma", code: ont.fma, display: organ.ta2_latin },
      ],
      text: `${organ.name_en} (${organ.ta2_latin})`,
    },
    ...(laterality
      ? {
          locationQualifier: [
            { coding: [{ system: "http://snomed.info/sct", code: laterality.code, display: laterality.display }] },
          ],
        }
      : {}),
  };
}

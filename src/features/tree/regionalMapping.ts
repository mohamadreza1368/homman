/**
 * Regional Anatomy Mapping Engine
 *
 * Implements topographic & regional anatomical partitioning according to
 * Terminologia Anatomica (TA2) Part 1 (Anatomia Generalis - Partes Corporis Humani)
 * and Gray's Anatomy Regional division.
 */

import type { ManifestOrgan } from "@/lib/schemas";

export type AnatomicalRegionId =
  | "head_neck"
  | "thorax"
  | "abdomen"
  | "pelvis"
  | "back_spine"
  | "upper_limb"
  | "lower_limb";

export interface AnatomicalRegionMeta {
  id: AnatomicalRegionId;
  nameEn: string;
  nameFa: string;
  color: string;
  descriptionFa: string;
}

export const ANATOMICAL_REGIONS: Record<AnatomicalRegionId, AnatomicalRegionMeta> = {
  head_neck: {
    id: "head_neck",
    nameEn: "Head & Neck",
    nameFa: "سر و گردن",
    color: "#f59e0b",
    descriptionFa: "جمجمه، مغز، صورت، حواس ویژه، حلق و حنجره",
  },
  thorax: {
    id: "thorax",
    nameEn: "Thorax",
    nameFa: "قفسه سینه",
    color: "#ef4444",
    descriptionFa: "قلب، ریه‌ها، مدیاستینوم، دنده‌ها و دیافراگم",
  },
  abdomen: {
    id: "abdomen",
    nameEn: "Abdomen",
    nameFa: "شکم",
    color: "#10b981",
    descriptionFa: "کبد، معده، کلیه‌ها، لوزالمعده، روده و صفاق",
  },
  pelvis: {
    id: "pelvis",
    nameEn: "Pelvis & Perineum",
    nameFa: "لگن و پرینه",
    color: "#8b5cf6",
    descriptionFa: "مثانه، اندام‌های تناسلی و کف لگن",
  },
  back_spine: {
    id: "back_spine",
    nameEn: "Back & Spine",
    nameFa: "پشت و ستون مهره‌ها",
    color: "#64748b",
    descriptionFa: "ستون فقرات، نخاع و عضلات عمقی پشتی",
  },
  upper_limb: {
    id: "upper_limb",
    nameEn: "Upper Limb",
    nameFa: "اندام فوقانی",
    color: "#06b6d4",
    descriptionFa: "شانه، بازو، ساعد و دست",
  },
  lower_limb: {
    id: "lower_limb",
    nameEn: "Lower Limb",
    nameFa: "اندام تحتانی",
    color: "#3b82f6",
    descriptionFa: "کمربند لگنی، ران، زانو، ساق و پا",
  },
};

export const ORDERED_REGIONS: AnatomicalRegionId[] = [
  "head_neck",
  "thorax",
  "abdomen",
  "pelvis",
  "back_spine",
  "upper_limb",
  "lower_limb",
];

const HEAD_NECK_REGEX =
  /head|neck|cranial|cervical|skull|cranium|brain|cerebr|cerebell|encephal|face|facial|mouth|oral|tongue|lingual|mandib|maxill|temporal|parietal|frontal|occipital|thyroid|jugular|carotid|larynx|laryngeal|pharynx|pharyngeal|eye|orbit|ocular|nasal|nose|ear|auricul|auris/i;

const UPPER_LIMB_REGEX =
  /upper.?limb|arm|forearm|hand|brachial|axill|clavicle|scapul|humer|radius|ulna|carpal|carpi|finger|palmar|deltoid|pectoralis|subclavian|radial|ulnar|median|pollic|biceps_brachii|triceps_brachii|pronator|supinator/i;

const LOWER_LIMB_REGEX =
  /lower.?limb|thigh|leg|foot|pedis|plantar|femur|femoral|patella|tibia|tibial|fibula|fibular|perone|hip|glute|tarsal|toe|halluc|poplite|sciatic|crural|calcane|saphenous|gastrocnem|soleus|quadriceps|sartorius|iliopsoas|adductor_longus|adductor_magnus|gracilis/i;

const THORAX_REGEX =
  /thorax|thoracic|heart|cardiac|myocard|pericard|lung|pulmo|pulmonary|pleura|rib|costal|sternum|sternal|trachea|bronch|mediastin|intercostal|aorta|azygos|esophag|thymus/i;

const PELVIS_REGEX =
  /pelvis|pelvic|genital|bladder|urinary|rectum|prostate|uterus|uterine|ovary|ovarian|fallopian|testis|testicular|scrot|perine|sacr|coccyx|iliac|pudendal|seminal/i;

const ABDOMEN_REGEX =
  /abdomen|abdominal|stomach|gastric|liver|hepatic|gallbladder|biliary|pancrea|spleen|splenic|kidney|renal|celiac|mesenter|peritone|omental|duodenum|jejunum|ileum|colon|cecum|appendix|suprarenal|adrenal|pylorus|quadratus_lumborum/i;

const BACK_SPINE_REGEX =
  /vertebra|spine|spinal|dorsal|back|lumbar|sacral|erector_spinae|multifidus|latissimus/i;

/**
 * Classifies an organ into its primary topographic anatomical region.
 */
export function getOrganRegion(organ: ManifestOrgan): AnatomicalRegionId {
  const p = (organ.path || []).join(" ").toLowerCase();
  const id = (organ.organ_id || "").toLowerCase();
  const name = (organ.name_en || "").toLowerCase();
  const latin = (organ.ta2_latin || "").toLowerCase();
  const text = `${p} ${id} ${name} ${latin}`;

  if (HEAD_NECK_REGEX.test(text)) return "head_neck";
  if (UPPER_LIMB_REGEX.test(text)) return "upper_limb";
  if (LOWER_LIMB_REGEX.test(text)) return "lower_limb";
  if (THORAX_REGEX.test(text)) return "thorax";
  if (PELVIS_REGEX.test(text)) return "pelvis";
  if (ABDOMEN_REGEX.test(text)) return "abdomen";
  if (BACK_SPINE_REGEX.test(text)) return "back_spine";

  return "thorax";
}

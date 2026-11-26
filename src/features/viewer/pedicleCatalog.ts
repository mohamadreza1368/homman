/**
 * Neurovascular & Surgical Pedicle Engine
 *
 * Implements anatomical pedicle resolution based on Gray's Surgical Anatomy,
 * Skandalakis Surgical Anatomy, and Moore Clinically Oriented Anatomy.
 *
 * A surgical pedicle (پدیکل عروقی-عصبی) connects an organ to its nutrient
 * arteries, venous drainage, nerve trunks, and excretory/lymphatic ducts.
 */

import type { ManifestOrgan } from "@/lib/schemas";

export interface PedicleDefinition {
  organPattern: RegExp;
  labelEn: string;
  labelFa: string;
  resolvePedicleIds: (targetOrganId: string, allOrgans: Record<string, ManifestOrgan>) => string[];
}

export const SURGICAL_PEDICLES: PedicleDefinition[] = [
  // 1. Kidney (Renal Pedicle / Hilum Renale)
  {
    organPattern: /^kidney_(l|r)$/i,
    labelEn: "Renal Neurovascular Pedicle & Hilum",
    labelFa: "پدیکل عروقی-عصبی و ناف کلیه",
    resolvePedicleIds: (targetId, allOrgans) => {
      const isLeft = /_l$/i.test(targetId);
      const sideStr = isLeft ? "left" : "right";
      const sideSuffix = isLeft ? "_l" : "_r";
      const ids: string[] = [targetId];

      for (const [id, organ] of Object.entries(allOrgans)) {
        const lowerId = id.toLowerCase();
        const matchesSide = lowerId.includes(sideStr) || lowerId.endsWith(sideSuffix);
        if (!matchesSide) continue;

        if (
          lowerId.includes("renal_artery") ||
          lowerId.includes("renal_vein") ||
          lowerId.includes("renal_pelvis") ||
          lowerId.includes("intrarenal") ||
          lowerId.includes("ureter") ||
          lowerId.includes("suprarenal_artery")
        ) {
          ids.push(organ.organ_id);
        }
      }
      return Array.from(new Set(ids));
    },
  },

  // 2. Liver (Porta Hepatis / Hepatic Pedicle)
  {
    organPattern: /^(liver|anterior_lateral_segment_of_liver)/i,
    labelEn: "Porta Hepatis & Hepatic Neurovascular Triad",
    labelFa: "سه‌گانه پورتال و پدیکل عروقی کبد",
    resolvePedicleIds: (targetId, allOrgans) => {
      const ids: string[] = [targetId, "liver"];
      for (const [id, organ] of Object.entries(allOrgans)) {
        const lowerId = id.toLowerCase();
        if (
          lowerId.includes("hepatic_artery") ||
          lowerId.includes("portal_vein") ||
          lowerId.includes("hepatic_vein") ||
          lowerId.includes("bile_duct") ||
          lowerId.includes("cystic_duct") ||
          lowerId === "gallbladder" ||
          lowerId.includes("celiac_trunk")
        ) {
          ids.push(organ.organ_id);
        }
      }
      return Array.from(new Set(ids));
    },
  },

  // 3. Stomach (Gastric Vascular Pedicles)
  {
    organPattern: /^stomach$/i,
    labelEn: "Gastric Neurovascular Pedicles & Celiac Trunk",
    labelFa: "عروق تغذیه‌کننده و پدیکل‌های معده",
    resolvePedicleIds: (targetId, allOrgans) => {
      const ids: string[] = [targetId];
      for (const [id, organ] of Object.entries(allOrgans)) {
        const lowerId = id.toLowerCase();
        if (
          lowerId.includes("left_gastric_artery") ||
          lowerId.includes("right_gastric") ||
          lowerId.includes("gastroepiploic") ||
          lowerId.includes("short_gastric") ||
          lowerId.includes("celiac_trunk") ||
          lowerId.includes("gastroduodenal") ||
          lowerId.includes("splenic_artery")
        ) {
          ids.push(organ.organ_id);
        }
      }
      return Array.from(new Set(ids));
    },
  },

  // 4. Spleen (Splenic Pedicle / Lienal Hilum)
  {
    organPattern: /^spleen$/i,
    labelEn: "Splenic Pedicle & Hilum",
    labelFa: "پدیکل عروقی و ناف طحال",
    resolvePedicleIds: (targetId, allOrgans) => {
      const ids: string[] = [targetId];
      for (const [id, organ] of Object.entries(allOrgans)) {
        const lowerId = id.toLowerCase();
        if (
          lowerId.includes("splenic_artery") ||
          lowerId.includes("splenic_vein") ||
          lowerId.includes("splenic_nodes") ||
          lowerId.includes("short_gastric")
        ) {
          ids.push(organ.organ_id);
        }
      }
      return Array.from(new Set(ids));
    },
  },

  // 5. Thyroid / Laryngeal Region (Thyroid Surgical Pedicle)
  {
    organPattern: /^(thyroid|thyroid_cartilage)/i,
    labelEn: "Thyroid Superior & Inferior Vascular Pedicles",
    labelFa: "پدیکل‌های عروقی فوقانی و تحتانی تیروئید",
    resolvePedicleIds: (targetId, allOrgans) => {
      const ids: string[] = [targetId, "thyroid_cartilage"];
      for (const [id, organ] of Object.entries(allOrgans)) {
        const lowerId = id.toLowerCase();
        if (
          lowerId.includes("superior_thyroid_artery") ||
          lowerId.includes("inferior_thyroid_artery") ||
          lowerId.includes("thyroid_vein") ||
          lowerId.includes("laryngeal_nerve") ||
          lowerId.includes("internal_jugular") ||
          lowerId.includes("common_carotid")
        ) {
          ids.push(organ.organ_id);
        }
      }
      return Array.from(new Set(ids));
    },
  },

  // 6. Lung (Pulmonary Hilum / Root of Lung)
  {
    organPattern: /^(lung_l|lung_r|left_lung|right_lung)/i,
    labelEn: "Pulmonary Hilum & Root of Lung",
    labelFa: "ناف ریه و ریشه عروقی-نایژه‌ای",
    resolvePedicleIds: (targetId, allOrgans) => {
      const isLeft = /_l$|left/i.test(targetId);
      const sideStr = isLeft ? "left" : "right";
      const ids: string[] = [targetId];

      for (const [id, organ] of Object.entries(allOrgans)) {
        const lowerId = id.toLowerCase();
        if (
          (lowerId.includes("pulmonary_artery") ||
            lowerId.includes("pulmonary_vein") ||
            lowerId.includes("lingular_artery") ||
            lowerId.includes("lobar_artery") ||
            lowerId.includes("bronch")) &&
          (lowerId.includes(sideStr) || !lowerId.includes(isLeft ? "right" : "left"))
        ) {
          ids.push(organ.organ_id);
        }
      }
      return Array.from(new Set(ids));
    },
  },

  // 7. Heart & Great Vessels
  {
    organPattern: /(heart|coronary|aorta|pulmonary_trunk)/i,
    labelEn: "Cardiac Great Vessels & Coronary Circulation",
    labelFa: "ریشه عروق بزرگ و شبکه عروق کرونری قلب",
    resolvePedicleIds: (targetId, allOrgans) => {
      const ids: string[] = [targetId];
      for (const [id, organ] of Object.entries(allOrgans)) {
        const lowerId = id.toLowerCase();
        if (
          lowerId.includes("coronary_artery") ||
          lowerId.includes("circumflex_artery") ||
          lowerId.includes("ascending_aorta") ||
          lowerId.includes("arch_of_aorta") ||
          lowerId.includes("pulmonary_trunk") ||
          lowerId.includes("superior_vena_cava") ||
          lowerId.includes("inferior_vena_cava") ||
          lowerId.includes("cardiac_vein")
        ) {
          ids.push(organ.organ_id);
        }
      }
      return Array.from(new Set(ids));
    },
  },

  // 8. Suprarenal / Adrenal Gland
  {
    organPattern: /^suprarenal_gland_(l|r)$/i,
    labelEn: "Suprarenal Neurovascular Stalk",
    labelFa: "پایه عروقی غده فوق‌کلیوی",
    resolvePedicleIds: (targetId, allOrgans) => {
      const isLeft = /_l$/i.test(targetId);
      const sideSuffix = isLeft ? "_l" : "_r";
      const ids: string[] = [targetId];
      for (const [id, organ] of Object.entries(allOrgans)) {
        const lowerId = id.toLowerCase();
        if (
          (lowerId.includes("suprarenal_artery") || lowerId.includes("suprarenal_vein")) &&
          lowerId.endsWith(sideSuffix)
        ) {
          ids.push(organ.organ_id);
        }
      }
      return Array.from(new Set(ids));
    },
  },
];

/**
 * Finds if an organ has an associated neurovascular pedicle.
 */
export function getPedicleDefinition(organId: string): PedicleDefinition | undefined {
  return SURGICAL_PEDICLES.find((pedicle) => pedicle.organPattern.test(organId));
}

/**
 * Resolves all organs belonging to the surgical pedicle of a target structure.
 */
export function resolvePedicleMembers(
  organId: string,
  organCatalog: Record<string, ManifestOrgan>,
): string[] {
  const pedicleDef = getPedicleDefinition(organId);
  if (!pedicleDef) return [organId];
  return pedicleDef.resolvePedicleIds(organId, organCatalog);
}

import * as THREE from "three";
import type { AnatomicalSystem } from "@/lib/schemas";

export const SYSTEM_COLOURS: Record<AnatomicalSystem, string> = Object.freeze({
  skeletal: "#e2d8c3",
  articular: "#bfcbd1",
  muscular: "#9e3f45",
  cardiovascular: "#b0484a",
  nervous: "#ddd08a",
  lymphatic: "#8fb583",
  digestive: "#c08a63",
  respiratory: "#d3a0a3",
  renal: "#9c5344",
  endocrine: "#d3a03f",
  reproductive: "#bd8aa4",
  integumentary: "#dfb098",
  regional: "#b4aea6",
});

export const SYSTEM_LABELS: Record<AnatomicalSystem, string> = Object.freeze({
  skeletal: "Bone",
  articular: "Joint",
  muscular: "Muscle",
  cardiovascular: "Heart & vessel",
  nervous: "Nerve",
  lymphatic: "Lymphatic",
  digestive: "Digestive tract",
  respiratory: "Airway",
  renal: "Urinary",
  endocrine: "Endocrine gland",
  reproductive: "Reproductive",
  integumentary: "Skin and breast",
  regional: "Surface & regional",
});

export interface TissueFamily {
  id: string;
  label: string;
  hex: string;
}

const VENOUS_BLUE_TONE = "#4a6ea8";
const ARTERIAL_RED_TONE = "#c0392f";

const VENOUS_PATTERN = /\b(vena|venae|venous|vein|veins|sinus)\b/i;
const ARTERIAL_PATTERN =
  /\b(arteria|arteriae|arterial|artery|arteries|aorta|aortae|aortic|truncus|arcus|ramus|rami|anastomosis|bifurcatio)\b/i;

interface ClassificationRule {
  readonly id: string;
  readonly label: string;
  readonly test: RegExp;
  readonly colour: string;
  readonly systems?: readonly AnatomicalSystem[];
}

const TISSUE_RULES: readonly ClassificationRule[] = Object.freeze([
  {
    id: "connective",
    label: "Tendon & fascia",
    test: /\b(tendo|tendon|tendons|tendinis|aponeurosis|fascia|retinaculum|septum intermusculare)\b/i,
    colour: "#ded3bd",
  },
  {
    id: "ligament",
    label: "Ligament",
    test: /\b(ligamentum|ligament|ligaments|ligamenta)\b/i,
    colour: "#d6cbb4",
  },
  {
    id: "cartilage",
    label: "Cartilage & disc",
    test: /\b(cartilago|cartilage|cartilagines|meniscus|discus|labrum)\b/i,
    colour: "#c6d4d9",
  },
  {
    id: "fat",
    label: "Fat",
    test: /\b(adiposum|adipose|fat|panniculus|corpus adiposum)\b/i,
    colour: "#e3c869",
  },
  {
    id: "tooth",
    label: "Tooth",
    test: /\b(dens|dentes|tooth|teeth|molaris|incisivus|caninus|enamel|enamelum)\b/i,
    colour: "#f1ead9",
    systems: ["digestive"],
  },
  {
    id: "grey-matter",
    label: "Grey matter",
    test: /\b(substantia grisea|grey matter|gray matter|cortex cerebri)\b/i,
    colour: "#a89098",
  },
  {
    id: "white-matter",
    label: "White matter",
    test: /\b(substantia alba|white matter|corpus callosum)\b/i,
    colour: "#ece3d6",
  },
  { id: "dura", label: "Dura mater", test: /\b(dura mater|dural)\b/i, colour: "#bda893" },
  {
    id: "spinal-cord",
    label: "Spinal cord",
    test: /\b(medulla spinalis|spinal cord)\b/i,
    colour: "#e6dcc4",
  },
  { id: "liver", label: "Liver", test: /\b(hepar|liver|hepatis)\b/i, colour: "#7d4234" },
  {
    id: "biliary",
    label: "Gallbladder & bile",
    test: /\b(vesica biliaris|vesica fellea|gallbladder|bilis|bile)\b/i,
    colour: "#5f7a3f",
  },
  {
    id: "spleen",
    label: "Spleen",
    test: /\b(splen|lien|spleen|splenic)\b/i,
    colour: "#6f3550",
  },
  { id: "pancreas", label: "Pancreas", test: /\b(pancreas|pancreatic)\b/i, colour: "#d8bf8b" },
  { id: "stomach", label: "Stomach", test: /\b(gaster|stomach|gastric)\b/i, colour: "#c98f7a" },
  { id: "lung", label: "Lung", test: /\b(pulmo|lung|lungs|pulmonis)\b/i, colour: "#cf9ba0" },
  {
    id: "kidney",
    label: "Kidney",
    test: /\b(ren|renis|kidney|kidneys|renal cortex)\b/i,
    colour: "#8f4a3a",
  },
  {
    id: "adrenal",
    label: "Adrenal gland",
    test: /\b(glandula suprarenalis|suprarenal|adrenal)\b/i,
    colour: "#d8b24e",
  },
  {
    id: "thyroid",
    label: "Thyroid",
    test: /\b(glandula thyroidea|thyroid|thyroidea)\b/i,
    colour: "#9c5a4a",
  },
  {
    id: "myocardium",
    label: "Myocardium",
    test: /\b(myocardium|myocardial)\b/i,
    colour: "#a63f42",
  },
  {
    id: "lymphoid",
    label: "Lymphoid tissue",
    test: /\b(thymus|tonsilla|tonsil|nodus lymphoideus|lymph node)\b/i,
    colour: "#96bd8a",
  },
  { id: "sclera", label: "Sclera", test: /\b(sclera|scleral)\b/i, colour: "#f0ece2" },
  { id: "iris", label: "Iris", test: /\biris\b/i, colour: "#3f6fa8" },
  {
    id: "ocular-interior",
    label: "Vitreous body",
    test: /\b(corpus vitreum|humor vitreus|vitreous)\b/i,
    colour: "#141a24",
  },
  {
    id: "ocular-clear",
    label: "Cornea & lens",
    test: /\b(cornea|corneal|lens|lentis|camera anterior|anterior chamber|segmentum anterius|anterior segment)\b/i,
    colour: "#cfe2ea",
  },
  { id: "nail", label: "Nail", test: /\b(unguis|nail|nails)\b/i, colour: "#e8c9bb" },
  { id: "hair", label: "Hair", test: /\b(pilus|pili|hair|capillus)\b/i, colour: "#5b4636" },
]);

export interface Tissue {
  organ_id: string;
  ta2_latin: string;
  name_en: string;
  system: AnatomicalSystem;
}

export function tissueFamily(organ: Tissue): TissueFamily {
  const combinedName = `${organ.ta2_latin} ${organ.name_en}`;

  if (organ.system === "cardiovascular") {
    if (VENOUS_PATTERN.test(combinedName)) {
      return { id: "vein", label: "Vein", hex: VENOUS_BLUE_TONE };
    }
    if (ARTERIAL_PATTERN.test(combinedName)) {
      return { id: "artery", label: "Artery", hex: ARTERIAL_RED_TONE };
    }
  }

  for (let i = 0; i < TISSUE_RULES.length; i++) {
    const candidateRule = TISSUE_RULES[i]!;
    if (candidateRule.systems && !candidateRule.systems.includes(organ.system)) {
      continue;
    }
    if (candidateRule.test.test(combinedName)) {
      return {
        id: candidateRule.id,
        label: candidateRule.label,
        hex: candidateRule.colour,
      };
    }
  }

  return {
    id: organ.system,
    label: SYSTEM_LABELS[organ.system],
    hex: SYSTEM_COLOURS[organ.system],
  };
}

export function tissueHex(organ: Tissue): string {
  return tissueFamily(organ).hex;
}

const UNVARYING_SYSTEMS: ReadonlySet<AnatomicalSystem> = new Set([
  "regional",
  "integumentary",
]);

function computeFnv1a32(str: string): number {
  let hashVal = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hashVal ^= str.charCodeAt(i);
    hashVal = Math.imul(hashVal, 0x01000193);
  }
  return hashVal >>> 0;
}

function normalizeHashByte(entropy: number, bitOffset: number): number {
  return ((entropy >>> bitOffset) & 0xff) / 128 - 1;
}

const COLOR_CACHE = new Map<string, THREE.Color>();

export function tissueColour(organ: Tissue): THREE.Color {
  const existing = COLOR_CACHE.get(organ.organ_id);
  if (existing) return existing;

  const baseColor = new THREE.Color(tissueHex(organ));

  if (!UNVARYING_SYSTEMS.has(organ.system)) {
    const entropy = computeFnv1a32(organ.organ_id);
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);

    const hueOffset = (hsl.h + normalizeHashByte(entropy, 0) * 0.014 + 1) % 1;
    const satOffset = Math.min(Math.max(hsl.s + normalizeHashByte(entropy, 8) * 0.06, 0), 1);
    const litOffset = Math.min(Math.max(hsl.l + normalizeHashByte(entropy, 16) * 0.062, 0.04), 0.96);

    baseColor.setHSL(hueOffset, satOffset, litOffset);
  }

  COLOR_CACHE.set(organ.organ_id, baseColor);
  return baseColor;
}

const TISSUE_ROUGHNESS_MAP: Partial<Record<AnatomicalSystem, number>> = {
  skeletal: 0.72,
  articular: 0.26,
  muscular: 0.4,
  cardiovascular: 0.28,
  nervous: 0.54,
  lymphatic: 0.42,
  respiratory: 0.45,
  digestive: 0.26,
  renal: 0.3,
  endocrine: 0.36,
  reproductive: 0.34,
  integumentary: 0.6,
  regional: 0.68,
};

export function tissueRoughness(system: AnatomicalSystem): number {
  return TISSUE_ROUGHNESS_MAP[system] ?? 0.5;
}

const TISSUE_METALNESS_MAP: Partial<Record<AnatomicalSystem, number>> = {
  skeletal: 0.02,
  articular: 0.06,
  muscular: 0.04,
  cardiovascular: 0.08,
  digestive: 0.06,
  respiratory: 0.03,
  nervous: 0.02,
  lymphatic: 0.03,
  endocrine: 0.05,
  renal: 0.05,
  reproductive: 0.04,
  integumentary: 0.02,
  regional: 0.02,
};

export function tissueMetalness(system: AnatomicalSystem): number {
  return TISSUE_METALNESS_MAP[system] ?? 0.04;
}

const OPACITY_SPECIAL_CASES: Record<string, number> = {
  "ocular-clear": 0.18,
  "ocular-interior": 0.55,
  connective: 0.42,
};

export function tissueOpacity(organ: Tissue): number {
  const familyId = tissueFamily(organ).id;
  return OPACITY_SPECIAL_CASES[familyId] ?? 1.0;
}

const SYSTEM_DEPTH_BIAS: Readonly<Record<string, number>> = {
  regional: -4,
  integumentary: -4,
  connective: -1,
  ligament: -1,
};

export function tissueDepthBias(organ: Tissue): number {
  const familyId = tissueFamily(organ).id;
  return SYSTEM_DEPTH_BIAS[familyId] ?? 0;
}

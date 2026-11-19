/**
 * Hoomaan 3D Viewer - Anatomical Tissue Colour Palette, Opacity & Shading Models
 */

import * as THREE from "three";
import type { AnatomicalSystem } from "@/lib/schemas";

export const SYSTEM_COLOURS: Record<AnatomicalSystem, string> = {
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
};

export const SYSTEM_LABELS: Record<AnatomicalSystem, string> = {
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
};

export interface TissueFamily {
  id: string;
  label: string;
  hex: string;
}

const VEIN_BLUE = "#4a6ea8";
const ARTERY_RED = "#c0392f";

const VENOUS = /\b(vena|venae|venous|vein|veins|sinus)\b/i;
const ARTERIAL = /\b(arteria|arteriae|arterial|artery|arteries|aorta|truncus)\b/i;

interface TissueRule {
  readonly id: string;
  readonly label: string;
  readonly test: RegExp;
  readonly colour: string;
  readonly systems?: readonly AnatomicalSystem[];
}

const RULES: readonly TissueRule[] = [
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
];

export interface Tissue {
  organ_id: string;
  ta2_latin: string;
  name_en: string;
  system: AnatomicalSystem;
}

/** Determines functional tissue palette classification for specified organ. */
export function tissueFamily(organ: Tissue): TissueFamily {
  const name = `${organ.ta2_latin} ${organ.name_en}`;

  if (organ.system === "cardiovascular") {
    if (VENOUS.test(name)) return { id: "vein", label: "Vein", hex: VEIN_BLUE };
    if (ARTERIAL.test(name)) return { id: "artery", label: "Artery", hex: ARTERY_RED };
  }

  for (const rule of RULES) {
    if (rule.systems && !rule.systems.includes(organ.system)) continue;
    if (rule.test.test(name)) {
      return { id: rule.id, label: rule.label, hex: rule.colour };
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

const CONTINUOUS: ReadonlySet<AnatomicalSystem> = new Set(["regional", "integumentary"]);

function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function spread(seed: number, shift: number): number {
  return ((seed >>> shift) & 0xff) / 128 - 1;
}

const cache = new Map<string, THREE.Color>();

/** Generates deterministic subtle shade variation for adjacent structures of the same tissue. */
export function tissueColour(organ: Tissue): THREE.Color {
  const cached = cache.get(organ.organ_id);
  if (cached) return cached;

  const colour = new THREE.Color(tissueHex(organ));
  if (!CONTINUOUS.has(organ.system)) {
    const seed = hash(organ.organ_id);
    const hsl = { h: 0, s: 0, l: 0 };
    colour.getHSL(hsl);
    colour.setHSL(
      (hsl.h + spread(seed, 0) * 0.014 + 1) % 1,
      Math.min(Math.max(hsl.s + spread(seed, 8) * 0.06, 0), 1),
      Math.min(Math.max(hsl.l + spread(seed, 16) * 0.062, 0.04), 0.96),
    );
  }

  cache.set(organ.organ_id, colour);
  return colour;
}

const ROUGHNESS: Partial<Record<AnatomicalSystem, number>> = {
  skeletal: 0.78,
  articular: 0.44,
  muscular: 0.38,
  cardiovascular: 0.32,
  nervous: 0.56,
  lymphatic: 0.44,
  respiratory: 0.46,
  digestive: 0.32,
  renal: 0.35,
  endocrine: 0.38,
  reproductive: 0.36,
  integumentary: 0.62,
  regional: 0.7,
};

export function tissueRoughness(system: AnatomicalSystem): number {
  return ROUGHNESS[system] ?? 0.5;
}

const METALNESS: Partial<Record<AnatomicalSystem, number>> = {
  skeletal: 0.02,
  articular: 0.08,
  muscular: 0.05,
  cardiovascular: 0.1,
  digestive: 0.08,
  respiratory: 0.04,
  nervous: 0.02,
  lymphatic: 0.04,
  endocrine: 0.06,
  renal: 0.06,
  reproductive: 0.05,
  integumentary: 0.02,
  regional: 0.02,
};

export function tissueMetalness(system: AnatomicalSystem): number {
  return METALNESS[system] ?? 0.04;
}

const TRANSPARENCY: Record<string, number> = {
  "ocular-clear": 0.18,
  "ocular-interior": 0.55,
  connective: 0.42,
};

export function tissueOpacity(organ: Tissue): number {
  return TRANSPARENCY[tissueFamily(organ).id] ?? 1;
}

const DEPTH_BIAS: Readonly<Record<string, number>> = {
  regional: -2,
  integumentary: -2,
  connective: -1,
  ligament: -1,
};

export function tissueDepthBias(organ: Tissue): number {
  return DEPTH_BIAS[tissueFamily(organ).id] ?? 0;
}

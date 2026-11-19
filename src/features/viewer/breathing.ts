/**
 * Hoomaan 3D Viewer - Respiratory Biomechanics & Anatomical Vertex Shader Injection
 */

import type { Material } from "three";
import type { ManifestOrgan } from "@/lib/schemas";
import { CARRY_ATTRIBUTE } from "./breathCarry";

export const BREATH_ROLE = {
  none: 0,
  chestWall: 1,
  lung: 2,
  diaphragm: 3,
  viscera: 4,
  belly: 5,
  heart: 6,
  vessel: 7,
} as const;

export type BreathRole = (typeof BREATH_ROLE)[keyof typeof BREATH_ROLE];

const toLower = (organ: Pick<ManifestOrgan, "name_en">) => organ.name_en.toLowerCase();
const matchesAny = (text: string, frags: readonly string[]) =>
  frags.some((f) => text.includes(f));

const CHEST_MUSCLES = [
  "intercostal",
  "pectoralis",
  "serratus anterior",
  "subclavius",
  "transversus thoracis",
  "levatores costarum",
  "serratus posterior",
];
const BELLY_MUSCLES = [
  "rectus abdominis",
  "external oblique",
  "internal oblique",
  "transversus abdominis",
  "pyramidalis",
  "rectus sheath",
  "linea alba",
];
const CHEST_SKIN = [
  "pectoral region",
  "presternal",
  "mammary",
  "infraclavicular",
  "lateral region of thorax",
];
const BELLY_SKIN = [
  "epigastric",
  "umbilic",
  "hypochondriac",
  "lateral region of abdomen",
  "hypogastric",
];
const RIBCAGE = ["rib", "costal", "stern", "xiphoid", "manubri", "costo", "chondro"];
const UNDER_DIAPHRAGM = [
  "liver",
  "hepat",
  "stomach",
  "spleen",
  "splen",
  "pancrea",
  "gallbladder",
  "duoden",
  "kidney",
  "suprarenal",
  "porta hepatis",
];

/** Determines anatomical respiratory kinematic role from manifest metadata. */
export function breathRole(
  organ: Pick<ManifestOrgan, "system" | "name_en" | "path">,
  heartChamber = false,
): BreathRole {
  const text = toLower(organ);
  const isInsertionMarking = organ.path?.[organ.path.length - 1] === "Muscular insertions";

  switch (organ.system) {
    case "respiratory":
      return matchesAny(text, ["lung", "bronch", "pleura"])
        ? BREATH_ROLE.lung
        : BREATH_ROLE.none;
    case "muscular":
      if (isInsertionMarking) return BREATH_ROLE.none;
      if (text === "diaphragm" || text.startsWith("diaphragmatic fascia")) {
        return BREATH_ROLE.diaphragm;
      }
      if (matchesAny(text, CHEST_MUSCLES)) return BREATH_ROLE.chestWall;
      if (matchesAny(text, BELLY_MUSCLES)) return BREATH_ROLE.belly;
      return BREATH_ROLE.none;
    case "skeletal":
    case "articular":
      return matchesAny(text, RIBCAGE) ? BREATH_ROLE.chestWall : BREATH_ROLE.none;
    case "regional":
      if (matchesAny(text, CHEST_SKIN)) return BREATH_ROLE.chestWall;
      if (matchesAny(text, BELLY_SKIN)) return BREATH_ROLE.belly;
      return BREATH_ROLE.none;
    case "digestive":
    case "renal":
    case "endocrine":
    case "lymphatic":
      return matchesAny(text, UNDER_DIAPHRAGM) && !text.includes("node")
        ? BREATH_ROLE.viscera
        : BREATH_ROLE.none;
    case "cardiovascular":
      if (heartChamber) return BREATH_ROLE.heart;
      if (organ.path?.includes("Pulmonary vessels")) return BREATH_ROLE.lung;
      return BREATH_ROLE.vessel;
    default:
      return BREATH_ROLE.none;
  }
}

export type BreathPatternId = "quiet" | "deep";

export interface BreathPattern {
  label: string;
  rate: string;
  period: number;
  inhale: number;
  depth: number;
  sinusSwing: number;
  what: string;
}

export const BREATH_PATTERNS: Record<BreathPatternId, BreathPattern> = {
  quiet: {
    label: "Quiet breathing",
    rate: "12 / min",
    period: 5,
    inhale: 0.4,
    depth: 1,
    sinusSwing: 0.05,
    what:
      "At rest, about half a litre a breath. Breathing in is the diaphragm's work; breathing out needs no muscle — the lungs and the chest wall spring back.",
  },
  deep: {
    label: "Deep breathing",
    rate: "6 / min",
    period: 10,
    inhale: 0.45,
    depth: 3,
    sinusSwing: 0.11,
    what:
      "The diaphragm descends several times further, and the muscles of the chest wall lift the ribs higher. Out is still mostly recoil.",
  },
};

/** Evaluates normalized 0–1 lung fill fraction at a given cycle time. */
export function breathFill(seconds: number, pattern: BreathPattern): number {
  const period = pattern.period;
  const phase = (((seconds % period) + period) % period) / period;
  if (phase < pattern.inhale) {
    return 0.5 - 0.5 * Math.cos((Math.PI * phase) / pattern.inhale);
  }
  return (
    0.5 + 0.5 * Math.cos((Math.PI * (phase - pattern.inhale)) / (1 - pattern.inhale))
  );
}

/** Returns true if current respiratory timestamp is within the inspiratory phase. */
export function breathingIn(seconds: number, pattern: BreathPattern): boolean {
  const phase = (((seconds % pattern.period) + pattern.period) % pattern.period) / pattern.period;
  return phase < pattern.inhale;
}

export const BREATH_TRAVEL = {
  diaphragm: 0.015,
  lungDown: 0.011,
  viscera: 0.012,
  chestForward: 0.005,
  chestOut: 0.0035,
  chestUp: 0.003,
  bellyForward: 0.007,
  heart: 0.005,
} as const;

export const BREATH_FILL = { value: 0 };
export const BREATH_FRAME: { value: number[] } = { value: [1.16, 1.46, 1.36] };
export const BREATH_AXIS: { value: number[] } = { value: [0, 1.32, 0.0] };

type Shader = Parameters<Material["onBeforeCompile"]>[0];

const ANCHOR = "#include <project_vertex>";
const formatNum = (v: number) => v.toFixed(4);

/** Injects respiratory vertex displacement kinematics into standard Three.js shader. */
export function injectBreath(shader: Shader, owner: unknown): void {
  if (!shader.vertexShader.includes(ANCHOR)) {
    throw new Error("Breathing: the expected three.js vertex chunk is missing.");
  }

  const data = (
    owner as
      | {
          userData?: {
            breathRole?: number;
            breathSpan?: readonly [number, number];
          };
        }
      | undefined
  )?.userData;

  const span = data?.breathSpan ?? [0, 1];
  shader.uniforms.uBreathFill = BREATH_FILL;
  shader.uniforms.uBreathAxis = BREATH_AXIS;
  shader.uniforms.uBreathRole = { value: data?.breathRole ?? BREATH_ROLE.none };
  shader.uniforms.uBreathSpan = { value: [span[0], span[1]] };
  shader.uniforms.uBreathFrame = BREATH_FRAME;

  if (owner && typeof owner === "object") {
    const material = owner as { defaultAttributeValues?: Record<string, number[]> };
    material.defaultAttributeValues = {
      ...material.defaultAttributeValues,
      [CARRY_ATTRIBUTE]: [0],
    };
  }

  shader.vertexShader =
    "uniform float uBreathFill;\nuniform vec3 uBreathAxis;\nuniform float uBreathRole;\nuniform vec2 uBreathSpan;\nuniform vec3 uBreathFrame;\n" +
    `attribute float ${CARRY_ATTRIBUTE};\n` +
    shader.vertexShader.replace(
      ANCHOR,
      `${ANCHOR}
if (uBreathFill > 0.0 && uBreathRole > 0.5) {
  vec4 breathWorld = modelMatrix * vec4(transformed, 1.0);
  vec2 breathFromAxis = vec2(breathWorld.x - uBreathAxis.x, breathWorld.z - uBreathAxis.z);
  vec2 breathOut = breathFromAxis / max(length(breathFromAxis), 1e-4);
  float breathUp = clamp((breathWorld.y - uBreathSpan.x) / max(uBreathSpan.y - uBreathSpan.x, 1e-4), 0.0, 1.0);
  float breathFront = 0.15 + 0.85 * clamp(0.5 + 0.5 * breathOut.y, 0.0, 1.0);
  float breathTall = (breathWorld.y - uBreathAxis.y) / 0.17;
  float breathTrunk = 1.0 - smoothstep(0.17, 0.24, abs(breathFromAxis.x));
  vec3 breathChest = vec3(breathOut.x * ${formatNum(BREATH_TRAVEL.chestOut)}, ${formatNum(BREATH_TRAVEL.chestUp)}, breathOut.y * ${formatNum(BREATH_TRAVEL.chestForward)})
    * exp(-breathTall * breathTall) * breathFront * breathTrunk;
  float breathBellyTall = (breathWorld.y - (uBreathAxis.y - 0.27)) / 0.14;
  vec3 breathBelly = vec3(breathOut.x * ${formatNum(BREATH_TRAVEL.bellyForward * 0.3)}, 0.0, breathOut.y * ${formatNum(BREATH_TRAVEL.bellyForward)})
    * exp(-breathBellyTall * breathBellyTall) * breathFront;
  vec3 breathViscera = vec3(0.0, -${formatNum(BREATH_TRAVEL.viscera)}, ${formatNum(BREATH_TRAVEL.viscera * 0.15)});
  vec3 breathMove = vec3(0.0);
  if (abs(uBreathRole - ${BREATH_ROLE.chestWall}.0) < 0.5) {
    breathMove = breathChest;
  } else if (abs(uBreathRole - ${BREATH_ROLE.lung}.0) < 0.5) {
    float base = 1.0 - clamp((breathWorld.y - uBreathFrame.x) / max(uBreathFrame.y - uBreathFrame.x, 1e-4), 0.0, 1.0);
    float onDome = 1.0 - smoothstep(0.07, 0.12, abs(breathFromAxis.x));
    breathMove = breathChest + vec3(0.0, -${formatNum(BREATH_TRAVEL.lungDown)} * base * base * onDome, 0.0);
  } else if (abs(uBreathRole - ${BREATH_ROLE.diaphragm}.0) < 0.5) {
    breathMove = vec3(0.0, -${formatNum(BREATH_TRAVEL.diaphragm)} * breathUp * breathUp, 0.0);
  } else if (abs(uBreathRole - ${BREATH_ROLE.viscera}.0) < 0.5) {
    breathMove = breathViscera;
  } else if (abs(uBreathRole - ${BREATH_ROLE.belly}.0) < 0.5) {
    breathMove = breathBelly;
  } else if (abs(uBreathRole - ${BREATH_ROLE.heart}.0) < 0.5) {
    breathMove = vec3(0.0, -${formatNum(BREATH_TRAVEL.heart)}, 0.0);
  } else if (abs(uBreathRole - ${BREATH_ROLE.vessel}.0) < 0.5) {
    float wall = max(smoothstep(0.03, 0.05, length(breathFromAxis)),
      smoothstep(uBreathFrame.z, uBreathFrame.z + 0.04, breathWorld.y));
    float middle = (1.0 - smoothstep(0.06, 0.11, abs(breathFromAxis.x)))
      * (1.0 - smoothstep(uBreathFrame.z, uBreathFrame.z + 0.08, breathWorld.y))
      * smoothstep(uBreathFrame.x - 0.06, uBreathFrame.x, breathWorld.y);
    vec3 own = (breathChest + breathBelly) * wall + vec3(0.0, -${formatNum(BREATH_TRAVEL.heart)}, 0.0) * middle * (1.0 - wall);
    breathMove = mix(own, breathViscera, clamp(${CARRY_ATTRIBUTE}, 0.0, 1.0));
  }
  breathWorld.xyz += breathMove * uBreathFill;
  mvPosition = viewMatrix * breathWorld;
  gl_Position = projectionMatrix * mvPosition;
}`,
    );
}

export function breathOnBeforeCompile(this: unknown, shader: Shader): void {
  injectBreath(shader, this);
}

export interface BreathData {
  breathRole: BreathRole;
  breathSpan?: readonly [number, number];
}

const STILL: BreathData = Object.freeze({ breathRole: BREATH_ROLE.none });

/** Builds immutable material userData payload for respiratory vertex shader. */
export function breathData(
  organ: Pick<ManifestOrgan, "system" | "name_en" | "path">,
  worldBox?: { min: { y: number }; max: { y: number } },
  heartChamber = false,
): BreathData {
  const role = breathRole(organ, heartChamber);
  if (role === BREATH_ROLE.none) return STILL;
  const span: readonly [number, number] | undefined =
    worldBox && role === BREATH_ROLE.diaphragm
      ? [worldBox.min.y, worldBox.max.y]
      : undefined;
  return Object.freeze(span ? { breathRole: role, breathSpan: span } : { breathRole: role });
}

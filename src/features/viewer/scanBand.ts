/**
 * Hoomaan 3D Viewer - Scanner Laser Plane Shader Injection & Animation Driver
 */

import type { Material } from "three";
import { injectBreath } from "./breathing";
import type { SectionPlaneName } from "./axialSlice";

export type ScanAxis = readonly [number, number, number];

export const STANDING: ScanAxis = [0, 1, 0];
export const FACING: ScanAxis = [0, 0, 1];

export function sweepAxis(plane: SectionPlaneName): ScanAxis {
  return plane === "front" ? FACING : STANDING;
}

export const SCAN_PLANE = { value: 0 };

export function setScanPlane(plane: SectionPlaneName): void {
  SCAN_PLANE.value = plane === "front" ? 1 : 0;
}

export const SHARED_SCAN = { value: 0 };
export const SHARED_AXIS: { value: number[] } = { value: [...STANDING] };
export const SCAN_ENTRY = { value: 0 };
export const SCAN_TINT: { value: number[] } = { value: [0.1, 1.2, 1.5] };

const WAKE_OF_BAND = 0.29;

export const SCAN_REVEAL = { value: 0 };
export const SCAN_DIRECTION = { value: -1 };
export const SCAN_GHOST = { value: 0 };
export const SCAN_PULSE = { value: 0 };
export const SCAN_PULSE_S = 0.4;
const PULSE_GAIN = 1.6;
const NATURAL_PULSE_GAIN = 2.4;

export function firePulse(): void {
  SCAN_PULSE.value = 1;
}

export function advanceScanPulse(delta: number): number {
  const left = Math.max(0, SCAN_PULSE.value - delta / SCAN_PULSE_S);
  SCAN_PULSE.value = left * left;
  return SCAN_PULSE.value;
}

export function setScanGhost(on: boolean): void {
  SCAN_GHOST.value = on ? 1 : 0;
}

function rememberDirection(next: number): void {
  const moved = next - SHARED_SCAN.value;
  if (moved !== 0) SCAN_DIRECTION.value = Math.sign(moved);
}

export function setScanReveal(on: boolean): void {
  SCAN_REVEAL.value = on ? 1 : 0;
}

const KEEPS_ITS_OWN: readonly [number, number, number] = [-1, -1, -1];

export function setScanTint(light: readonly [number, number, number]): void {
  SCAN_TINT.value[0] = light[0];
  SCAN_TINT.value[1] = light[1];
  SCAN_TINT.value[2] = light[2];
}

export const SCAN_ENTRY_S = 2.2;
let elapsed = 0;
let entry = 0;
export const SWEEP_CYCLE_S = 20;

type Shader = Parameters<Material["onBeforeCompile"]>[0];
const NEVER: readonly [number, number] = [1, -1];

export function scanBandOnBeforeCompile(this: unknown, shader: Shader): void {
  const vertexChunk = "#include <project_vertex>";
  const fragmentChunk = "#include <emissivemap_fragment>";
  if (
    !shader.vertexShader.includes(vertexChunk) ||
    !shader.fragmentShader.includes(fragmentChunk)
  ) {
    throw new Error("Patient scan PoC: the expected Three r185 shader chunks are missing.");
  }

  shader.uniforms.uScanAt = SHARED_SCAN;
  shader.uniforms.uScanAxis = SHARED_AXIS;
  shader.uniforms.uScanEntry = SCAN_ENTRY;
  shader.uniforms.uScanTint = SCAN_TINT;
  shader.uniforms.uScanReveal = SCAN_REVEAL;
  shader.uniforms.uScanGhost = SCAN_GHOST;
  shader.uniforms.uScanPulse = SCAN_PULSE;
  shader.uniforms.uScanDirection = SCAN_DIRECTION;
  shader.uniforms.uScanPlane = SCAN_PLANE;

  const owner = this as
    | {
        userData?: {
          scanSpan?: readonly [number, number];
          scanSpanFront?: readonly [number, number];
          revealColour?: readonly [number, number, number];
        };
      }
    | undefined;

  const span = owner?.userData?.scanSpan ?? NEVER;
  shader.uniforms.uOrganSpan = { value: [span[0], span[1]] };

  const spanFront = owner?.userData?.scanSpanFront ?? NEVER;
  shader.uniforms.uOrganSpanFront = { value: [spanFront[0], spanFront[1]] };

  const reveal = owner?.userData?.revealColour ?? KEEPS_ITS_OWN;
  shader.uniforms.uRevealColour = { value: [reveal[0], reveal[1], reveal[2]] };

  shader.vertexShader =
    "varying float vScanAlong;\nuniform vec3 uScanAxis;\n" +
    shader.vertexShader.replace(
      vertexChunk,
      `${vertexChunk}\nvScanAlong = dot((modelMatrix * vec4(transformed, 1.0)).xyz, uScanAxis);`,
    );

  shader.fragmentShader =
    "uniform float uScanAt;\nuniform float uScanEntry;\nuniform vec3 uScanTint;\n" +
    "uniform float uScanReveal;\nuniform vec3 uRevealColour;\n" +
    "uniform float uScanGhost;\nuniform float uScanDirection;\n" +
    "uniform float uScanPulse;\n" +
    "uniform vec2 uOrganSpan;\nuniform vec2 uOrganSpanFront;\nuniform float uScanPlane;\n" +
    "varying float vScanAlong;\n" +
    shader.fragmentShader.replace(
      fragmentChunk,
      `${fragmentChunk}
    float scanBand = 1.0 - smoothstep(0.008, 0.025, abs(vScanAlong - uScanAt));
    vec2 organSpan = mix(uOrganSpan, uOrganSpanFront, uScanPlane);
    float wake = smoothstep(organSpan.x - 0.02, organSpan.x + 0.02, uScanAt)
               * (1.0 - smoothstep(organSpan.y - 0.02, organSpan.y + 0.02, uScanAt));
    float behind = (uScanAt - vScanAlong) * uScanDirection;
    float ghost = smoothstep(0.0, 0.06, behind) * uScanGhost * uScanEntry;
    float grey = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(grey) * 0.32, ghost);

    vec3 revealTo = uRevealColour.r < 0.0 ? diffuseColor.rgb : uRevealColour;
    diffuseColor.rgb = mix(diffuseColor.rgb, revealTo, wake * uScanReveal * uScanEntry);
    totalEmissiveRadiance += uScanTint * (scanBand + ${WAKE_OF_BAND} * wake)
                           * uScanEntry * (1.0 - uScanReveal);
    vec3 pulseColour = uScanReveal > 0.5 && uRevealColour.r >= 0.0
      ? uRevealColour * ${NATURAL_PULSE_GAIN}
      : uScanTint;
    totalEmissiveRadiance += pulseColour * wake * uScanPulse * ${PULSE_GAIN} * uScanEntry;`,
    );

  injectBreath(shader, this);
}

const ON = Object.freeze({ onBeforeCompile: scanBandOnBeforeCompile });
const OFF = Object.freeze({});

export function scanBandMaterialProps(
  enabled: boolean,
  span?: readonly [number, number],
  revealColour?: readonly [number, number, number],
  spanFront?: readonly [number, number],
) {
  if (!enabled) return OFF;
  if (!span && !revealColour && !spanFront) return ON;
  return { ...ON, userData: { scanSpan: span, revealColour, scanSpanFront: spanFront } };
}

export const SWEEP_PROGRESS = { value: 0 };
export const SCAN_DROP = 0.42;

export function resetScanBand(): void {
  elapsed = SWEEP_CYCLE_S / 2;
  SWEEP_PROGRESS.value = 1;
  resetScanEntry();
}

export function resetScanEntry(): void {
  entry = 0;
  SCAN_ENTRY.value = 0;
}

export function advanceScanEntry(delta: number): number {
  entry = Math.max(0, Math.min(1, entry + delta / SCAN_ENTRY_S));
  SCAN_ENTRY.value = entry * entry * entry * (entry * (entry * 6 - 15) + 10);
  return SCAN_ENTRY.value;
}

export function holdScanBand(
  progress: number,
  axis: ScanAxis,
  from: number,
  to: number,
): void {
  const clamped = Math.max(0, Math.min(1, progress));
  const unit = normalise(axis);
  SHARED_AXIS.value[0] = unit[0];
  SHARED_AXIS.value[1] = unit[1];
  SHARED_AXIS.value[2] = unit[2];

  elapsed = clamped * (SWEEP_CYCLE_S / 2);
  SWEEP_PROGRESS.value = clamped;
  const held = from + (to - from) * clamped;
  rememberDirection(held);
  SHARED_SCAN.value = held;
}

export const SCAN_TRAVEL_M = { value: 0 };
export const SECTION_STEP_CM = 1;

export function stepFraction(cm: number = SECTION_STEP_CM): number {
  const travel = SCAN_TRAVEL_M.value;
  if (!(travel > 0)) return 0;
  return cm / 100 / travel;
}

export function scanFractionFor(along: number, from: number, to: number): number {
  const travel = to - from;
  if (!(travel > 0)) return 0.5;
  return Math.max(0, Math.min(1, (along - from) / travel));
}

export function scanRangeAlong(
  min: readonly [number, number, number],
  max: readonly [number, number, number],
  axis: ScanAxis,
): { from: number; to: number } {
  const unit = normalise(axis);
  let centre = 0;
  let reach = 0;
  for (let i = 0; i < 3; i++) {
    centre += ((min[i]! + max[i]!) / 2) * unit[i]!;
    reach += ((max[i]! - min[i]!) / 2) * Math.abs(unit[i]!);
  }
  return { from: centre - reach, to: centre + reach };
}

export function advanceScanBand(
  delta: number,
  axis: ScanAxis,
  from: number,
  to: number,
): void {
  const unit = normalise(axis);
  SHARED_AXIS.value[0] = unit[0];
  SHARED_AXIS.value[1] = unit[1];
  SHARED_AXIS.value[2] = unit[2];

  elapsed = (elapsed + delta * SCAN_ENTRY.value) % SWEEP_CYCLE_S;
  const half = SWEEP_CYCLE_S / 2;
  const progress = elapsed <= half ? elapsed / half : (SWEEP_CYCLE_S - elapsed) / half;
  SWEEP_PROGRESS.value = progress;
  const next = from + (to - from) * progress;
  rememberDirection(next);
  SHARED_SCAN.value = next;
}

function normalise(axis: ScanAxis): [number, number, number] {
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  if (!Number.isFinite(length) || length === 0) {
    throw new Error("Patient scan: the sweep axis must have a direction.");
  }
  return [axis[0] / length, axis[1] / length, axis[2] / length];
}

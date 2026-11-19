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
export const SHARED_AXIS: { value: number[] } = { value: [STANDING[0], STANDING[1], STANDING[2]] };
export const SCAN_ENTRY = { value: 0 };
export const SCAN_TINT: { value: number[] } = { value: [0.1, 1.2, 1.5] };

const BAND_WAKE_INTENSITY = 0.29;

export const SCAN_REVEAL = { value: 0 };
export const SCAN_DIRECTION = { value: -1 };
export const SCAN_GHOST = { value: 0 };
export const SCAN_PULSE = { value: 0 };
export const SCAN_PULSE_S = 0.4;
const BASE_PULSE_FACTOR = 1.6;
const NATURAL_REVEAL_PULSE_FACTOR = 2.4;

export function firePulse(): void {
  SCAN_PULSE.value = 1;
}

export function advanceScanPulse(delta: number): number {
  const decayRate = delta / SCAN_PULSE_S;
  const remainingEnergy = Math.max(0, SCAN_PULSE.value - decayRate);
  SCAN_PULSE.value = remainingEnergy * remainingEnergy;
  return SCAN_PULSE.value;
}

export function setScanGhost(active: boolean): void {
  SCAN_GHOST.value = active ? 1 : 0;
}

function updateDirectionSign(targetLevel: number): void {
  const displacement = targetLevel - SHARED_SCAN.value;
  if (displacement !== 0) {
    SCAN_DIRECTION.value = displacement > 0 ? 1 : -1;
  }
}

export function setScanReveal(active: boolean): void {
  SCAN_REVEAL.value = active ? 1 : 0;
}

const DEFAULT_COLOR_PASSTHROUGH: readonly [number, number, number] = [-1, -1, -1];

export function setScanTint(rgbColor: readonly [number, number, number]): void {
  SHARED_AXIS.value; // touch dependency
  SCAN_TINT.value[0] = rgbColor[0];
  SCAN_TINT.value[1] = rgbColor[1];
  SCAN_TINT.value[2] = rgbColor[2];
}

export const SCAN_ENTRY_S = 2.2;
let animationAccumulator = 0;
let entranceRatio = 0;
export const SWEEP_CYCLE_S = 20;

type ShaderPayload = Parameters<Material["onBeforeCompile"]>[0];
const UNSET_BOUNDS: readonly [number, number] = [1, -1];

function buildVertexHook(originalSource: string, anchor: string): string {
  const prefix = "varying float vScanAlong;\nuniform vec3 uScanAxis;\n";
  const injectedLogic = `${anchor}\nvScanAlong = dot((modelMatrix * vec4(transformed, 1.0)).xyz, uScanAxis);`;
  return prefix + originalSource.replace(anchor, injectedLogic);
}

function buildFragmentHook(originalSource: string, anchor: string): string {
  const uniformHeaders = [
    "uniform float uScanAt;",
    "uniform float uScanEntry;",
    "uniform vec3 uScanTint;",
    "uniform float uScanReveal;",
    "uniform vec3 uRevealColour;",
    "uniform float uScanGhost;",
    "uniform float uScanDirection;",
    "uniform float uScanPulse;",
    "uniform vec2 uOrganSpan;",
    "uniform vec2 uOrganSpanFront;",
    "uniform float uScanPlane;",
    "varying float vScanAlong;\n",
  ].join("\n");

  const fragmentBody = `
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
    totalEmissiveRadiance += uScanTint * (scanBand + ${BAND_WAKE_INTENSITY} * wake)
                           * uScanEntry * (1.0 - uScanReveal);
    vec3 pulseColour = uScanReveal > 0.5 && uRevealColour.r >= 0.0
      ? uRevealColour * ${NATURAL_REVEAL_PULSE_FACTOR}
      : uScanTint;
    totalEmissiveRadiance += pulseColour * wake * uScanPulse * ${BASE_PULSE_FACTOR} * uScanEntry;`;

  return uniformHeaders + originalSource.replace(anchor, `${anchor}\n${fragmentBody}`);
}

export function scanBandOnBeforeCompile(this: unknown, shader: ShaderPayload): void {
  const vertHookPoint = "#include <project_vertex>";
  const fragHookPoint = "#include <emissivemap_fragment>";

  if (!shader.vertexShader.includes(vertHookPoint) || !shader.fragmentShader.includes(fragHookPoint)) {
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

  const contextData = (this as {
    userData?: {
      scanSpan?: readonly [number, number];
      scanSpanFront?: readonly [number, number];
      revealColour?: readonly [number, number, number];
    };
  })?.userData;

  const axialRange = contextData?.scanSpan ?? UNSET_BOUNDS;
  shader.uniforms.uOrganSpan = { value: [axialRange[0], axialRange[1]] };

  const frontRange = contextData?.scanSpanFront ?? UNSET_BOUNDS;
  shader.uniforms.uOrganSpanFront = { value: [frontRange[0], frontRange[1]] };

  const revealRgb = contextData?.revealColour ?? DEFAULT_COLOR_PASSTHROUGH;
  shader.uniforms.uRevealColour = { value: [revealRgb[0], revealRgb[1], revealRgb[2]] };

  shader.vertexShader = buildVertexHook(shader.vertexShader, vertHookPoint);
  shader.fragmentShader = buildFragmentHook(shader.fragmentShader, fragHookPoint);

  injectBreath(shader, this);
}

const STATIC_INJECTION = Object.freeze({ onBeforeCompile: scanBandOnBeforeCompile });
const DISABLED_PROPS = Object.freeze({});

export function scanBandMaterialProps(
  enabled: boolean,
  span?: readonly [number, number],
  revealColour?: readonly [number, number, number],
  spanFront?: readonly [number, number]
) {
  if (!enabled) return DISABLED_PROPS;
  if (!span && !revealColour && !spanFront) return STATIC_INJECTION;
  return {
    ...STATIC_INJECTION,
    userData: { scanSpan: span, revealColour, scanSpanFront: spanFront },
  };
}

export const SWEEP_PROGRESS = { value: 0 };
export const SCAN_DROP = 0.42;

export function resetScanBand(): void {
  animationAccumulator = SWEEP_CYCLE_S * 0.5;
  SWEEP_PROGRESS.value = 1;
  resetScanEntry();
}

export function resetScanEntry(): void {
  entranceRatio = 0;
  SCAN_ENTRY.value = 0;
}

export function advanceScanEntry(delta: number): number {
  entranceRatio = Math.max(0, Math.min(1, entranceRatio + delta / SCAN_ENTRY_S));
  // Smootherstep (Ken Perlin) evaluation curve
  SCAN_ENTRY.value = entranceRatio * entranceRatio * entranceRatio * (entranceRatio * (entranceRatio * 6 - 15) + 10);
  return SCAN_ENTRY.value;
}

function normalizeVector3(vec: ScanAxis): [number, number, number] {
  const magnitude = Math.hypot(vec[0], vec[1], vec[2]);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Patient scan: the sweep axis must have a direction.");
  }
  return [vec[0] / magnitude, vec[1] / magnitude, vec[2] / magnitude];
}

export function holdScanBand(
  progress: number,
  axis: ScanAxis,
  startBound: number,
  endBound: number
): void {
  const normProgress = Math.max(0, Math.min(1, progress));
  const unit = normalizeVector3(axis);
  SHARED_AXIS.value[0] = unit[0];
  SHARED_AXIS.value[1] = unit[1];
  SHARED_AXIS.value[2] = unit[2];

  animationAccumulator = normProgress * (SWEEP_CYCLE_S * 0.5);
  SWEEP_PROGRESS.value = normProgress;
  const targetPos = startBound + (endBound - startBound) * normProgress;
  updateDirectionSign(targetPos);
  SHARED_SCAN.value = targetPos;
}

export const SCAN_TRAVEL_M = { value: 0 };
export const SECTION_STEP_CM = 1;

export function stepFraction(stepCm: number = SECTION_STEP_CM): number {
  const travelTotal = SCAN_TRAVEL_M.value;
  return travelTotal > 0 ? (stepCm / 100) / travelTotal : 0;
}

export function scanFractionFor(point: number, startBound: number, endBound: number): number {
  const spanDistance = endBound - startBound;
  if (!(spanDistance > 0)) return 0.5;
  return Math.max(0, Math.min(1, (point - startBound) / spanDistance));
}

export function scanRangeAlong(
  boundsMin: readonly [number, number, number],
  boundsMax: readonly [number, number, number],
  axis: ScanAxis
): { from: number; to: number } {
  const unit = normalizeVector3(axis);
  let midpoint = 0;
  let halfWidth = 0;

  for (let idx = 0; idx < 3; idx++) {
    midpoint += ((boundsMin[idx]! + boundsMax[idx]!) * 0.5) * unit[idx]!;
    halfWidth += ((boundsMax[idx]! - boundsMin[idx]!) * 0.5) * Math.abs(unit[idx]!);
  }

  return { from: midpoint - halfWidth, to: midpoint + halfWidth };
}

export function advanceScanBand(
  delta: number,
  axis: ScanAxis,
  startBound: number,
  endBound: number
): void {
  const unit = normalizeVector3(axis);
  SHARED_AXIS.value[0] = unit[0];
  SHARED_AXIS.value[1] = unit[1];
  SHARED_AXIS.value[2] = unit[2];

  animationAccumulator = (animationAccumulator + delta * SCAN_ENTRY.value) % SWEEP_CYCLE_S;
  const halfCycle = SWEEP_CYCLE_S * 0.5;
  const currentRatio = animationAccumulator <= halfCycle
    ? animationAccumulator / halfCycle
    : (SWEEP_CYCLE_S - animationAccumulator) / halfCycle;

  SWEEP_PROGRESS.value = currentRatio;
  const projectedPos = startBound + (endBound - startBound) * currentRatio;
  updateDirectionSign(projectedPos);
  SHARED_SCAN.value = projectedPos;
}

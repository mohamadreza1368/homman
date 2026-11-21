import * as THREE from "three";
import { DISCLAIMER, encodeImageBytes } from "./exportView";

/**
 * HOOMAAN Tomographic Viewport & Cross-Section Projection System
 * Clean-room architecture for 3D volumetric slicing, orthographic projection clipping,
 * and 2D canvas rasterization.
 */

export const SLAB_HALF_THICKNESS = 0.004;
export const MIN_SECTION_HALF_M = 0.03;
export const SLICE_MIN_HALF = 0.05;
export const MEASURE_LEVEL_TOLERANCE_M = 0.005;
export const WHEEL_PER_STEP = 100;
export const WHEEL_SETTLE_MS = 130;
export const RETAKE_INTERVAL_MS = 70;
export const SLICE_PIXELS_NORMAL = 2048;
export const SLICE_PIXELS_HIGH = 4096;
export const SECTION_WINDOW = "min(90vh, calc(100vw - 23rem))";

export type SectionPlaneName = "axial" | "front";

export interface SlicePlane {
  readonly name: SectionPlaneName;
  readonly normal: THREE.Vector3;
  readonly vertical: THREE.Vector3;
  readonly cameraUp: 1 | -1;
}

export interface SliceWindow {
  h: number;
  v: number;
  half: number;
}

export interface SliceBasis {
  right: 1 | -1;
  down: 1 | -1;
}

export interface SectionMeasure {
  ah: number;
  av: number;
  bh: number;
  bv: number;
  at: number;
  plane: SectionPlaneName;
}

export const AXIAL_PLANE: SlicePlane = Object.freeze({
  name: "axial",
  normal: new THREE.Vector3(0, 1, 0),
  vertical: new THREE.Vector3(0, 0, 1),
  cameraUp: -1,
});

export const FRONT_PLANE: SlicePlane = Object.freeze({
  name: "front",
  normal: new THREE.Vector3(0, 0, 1),
  vertical: new THREE.Vector3(0, 1, 0),
  cameraUp: 1,
});

export const SLICE_UP = cameraUpOf(AXIAL_PLANE);
export const SLICE_FORWARD = cameraForwardOf(AXIAL_PLANE);

export const SLICE_PIXELS = { value: SLICE_PIXELS_NORMAL };
export const SECTION_VIEW: { value: SliceWindow | null } = { value: null };
export const SECTION_WANTED = { value: 0 };
export const TORCH: { value: THREE.Vector3 | null } = { value: null };
export const AXIAL_CANVAS: { value: HTMLCanvasElement | null } = { value: null };

let activeSliceBuffer: ImageData | null = null;

export function slicePlane(planeName: SectionPlaneName): SlicePlane {
  return planeName === "front" ? FRONT_PLANE : AXIAL_PLANE;
}

export function cameraUpOf(plane: SlicePlane): THREE.Vector3 {
  return plane.vertical.clone().multiplyScalar(plane.cameraUp);
}

export function cameraForwardOf(plane: SlicePlane): THREE.Vector3 {
  return plane.normal.clone().negate();
}

export function planePoint(plane: SlicePlane, horizontal: number, vertical: number, depth: number): THREE.Vector3 {
  const result = new THREE.Vector3(horizontal, 0, 0);
  result.addScaledVector(plane.vertical, vertical);
  result.addScaledVector(plane.normal, depth);
  return result;
}

export function slabPlanes(plane: SlicePlane, offset: number, halfThickness: number = SLAB_HALF_THICKNESS): THREE.Plane[] {
  const norm = plane.normal;
  const forwardClip = new THREE.Plane(norm.clone().negate(), offset + halfThickness);
  const backwardClip = new THREE.Plane(norm.clone(), halfThickness - offset);
  return [forwardClip, backwardClip];
}

export function cutPlanes(plane: SlicePlane, offset: number): THREE.Plane[] {
  return [new THREE.Plane(plane.normal.clone().negate(), offset)];
}

export function depthLabel(depthMeters: number): string {
  const roundedCm = Math.max(0, Math.round(depthMeters * 100));
  return `${roundedCm} cm deep`;
}

export function sliceBasis(lateralInversion: 1 | -1): SliceBasis {
  return { right: lateralInversion, down: -1 };
}

export function sliceSize(highResolution: boolean, hardwareLimit: number): number {
  const target = highResolution ? SLICE_PIXELS_HIGH : SLICE_PIXELS_NORMAL;
  return hardwareLimit > 0 ? Math.min(target, hardwareLimit) : SLICE_PIXELS_NORMAL;
}

export function sliceWindowOf(boundingBox: THREE.Box3, plane: SlicePlane, safetyPadding = 1.06): SliceWindow {
  const midpoint = boundingBox.getCenter(new THREE.Vector3());
  const dimensions = boundingBox.getSize(new THREE.Vector3());
  const projectedSpan = Math.max(dimensions.x, dimensions.dot(plane.vertical));
  const radius = Math.max((projectedSpan * 0.5) * safetyPadding, SLICE_MIN_HALF);

  return {
    h: midpoint.x,
    v: midpoint.dot(plane.vertical),
    half: radius,
  };
}

function constrainWindow(subject: SliceWindow, parent: SliceWindow): SliceWindow {
  const allowedDelta = Math.max(0, parent.half - subject.half);
  const boundH = Math.min(parent.h + allowedDelta, Math.max(parent.h - allowedDelta, subject.h));
  const boundV = Math.min(parent.v + allowedDelta, Math.max(parent.v - allowedDelta, subject.v));

  return {
    h: boundH,
    v: boundV,
    half: subject.half,
  };
}

export function zoomWindow(
  current: SliceWindow,
  base: SliceWindow,
  factor: number,
  basis: SliceBasis,
  cursorU = 0,
  cursorV = 0,
): SliceWindow | null {
  if (factor <= 0 || base.half <= 0) return SECTION_VIEW.value;

  const targetRadius = Math.min(base.half, Math.max(MIN_SECTION_HALF_M, current.half / factor));
  if (targetRadius >= base.half) return null;

  const anchorH = current.h + basis.right * cursorU * current.half;
  const anchorV = current.v + basis.down * cursorV * current.half;

  return constrainWindow(
    {
      h: anchorH - basis.right * cursorU * targetRadius,
      v: anchorV - basis.down * cursorV * targetRadius,
      half: targetRadius,
    },
    base,
  );
}

export function panWindow(
  current: SliceWindow,
  base: SliceWindow,
  deltaX: number,
  deltaY: number,
  canvasDimension: number,
  basis: SliceBasis,
): SliceWindow | null {
  if (canvasDimension <= 0) return SECTION_VIEW.value;

  const worldPerPixel = (2 * current.half) / canvasDimension;
  const nextH = current.h - basis.right * deltaX * worldPerPixel;
  const nextV = current.v - basis.down * deltaY * worldPerPixel;

  return constrainWindow({ h: nextH, v: nextV, half: current.half }, base);
}

export function pointInSection(
  window: SliceWindow,
  screenX: number,
  screenY: number,
  viewportSize: number,
  basis: SliceBasis,
): { h: number; v: number } {
  const pixelRatio = (window.half * 2) / viewportSize;
  const centerShiftX = screenX - viewportSize * 0.5;
  const centerShiftY = screenY - viewportSize * 0.5;

  return {
    h: window.h + basis.right * centerShiftX * pixelRatio,
    v: window.v + basis.down * centerShiftY * pixelRatio,
  };
}

export function pointOnScreen(
  window: SliceWindow,
  worldH: number,
  worldV: number,
  viewportSize: number,
  basis: SliceBasis,
): { x: number; y: number } {
  if (window.half <= 0) return { x: 0, y: 0 };

  const projectionScale = viewportSize / (2 * window.half);
  const midPoint = viewportSize * 0.5;

  return {
    x: midPoint + basis.right * (worldH - window.h) * projectionScale,
    y: midPoint + basis.down * (worldV - window.v) * projectionScale,
  };
}

export function onLevel(
  measurement: Pick<SectionMeasure, "at" | "plane">,
  probeAt: number,
  probePlane: SectionPlaneName,
): boolean {
  return measurement.plane === probePlane && Math.abs(measurement.at - probeAt) <= MEASURE_LEVEL_TOLERANCE_M;
}

export function measureCm(points: Pick<SectionMeasure, "ah" | "av" | "bh" | "bv">): number {
  return Math.hypot(points.bh - points.ah, points.bv - points.av) * 100;
}

export function formatDistance(centimeters: number): string {
  if (centimeters <= 0) return "";
  if (centimeters < 1) return `${Math.round(centimeters * 10)} mm`;
  return `${centimeters.toFixed(1)} cm`;
}

export function wantSection(): void {
  SECTION_WANTED.value += 1;
}

export function wheelPixels(wheelDeltaY: number, mode: number): number {
  if (mode === 1 || mode === 2) {
    return Math.sign(wheelDeltaY) * WHEEL_PER_STEP;
  }
  return wheelDeltaY;
}

export function wheelSteps(
  accumulator: number,
  delta: number,
  unit = WHEEL_PER_STEP,
): { steps: number; carry: number } {
  const directionFlipped = accumulator !== 0 && delta !== 0 && Math.sign(accumulator) !== Math.sign(delta);
  const aggregate = directionFlipped ? delta : accumulator + delta;
  const quotient = Math.trunc(aggregate / unit);
  return {
    steps: quotient,
    carry: aggregate - quotient * unit,
  };
}

const TORCH_MIN_ELEVATION_RAD = (8 * Math.PI) / 180;

export function torchDirection(
  cursorNormalizedU: number,
  cursorNormalizedV: number,
  basis: SliceBasis,
  plane: SlicePlane,
): THREE.Vector3 {
  const cursorDist = Math.min(1, Math.hypot(cursorNormalizedU, cursorNormalizedV));
  const surfaceNormal = plane.normal.clone();

  if (cursorDist < 1e-6) return surfaceNormal;

  const horizon = new THREE.Vector3(basis.right * cursorNormalizedU, 0, 0)
    .addScaledVector(plane.vertical, basis.down * cursorNormalizedV)
    .normalize();

  const altitudeAngle =
    TORCH_MIN_ELEVATION_RAD + (1 - cursorDist) * (Math.PI * 0.5 - TORCH_MIN_ELEVATION_RAD);

  return horizon
    .multiplyScalar(Math.cos(altitudeAngle))
    .addScaledVector(surfaceNormal, Math.sin(altitudeAngle))
    .normalize();
}

function ensureSurfaceDimensions(elem: HTMLCanvasElement, edge: number): void {
  if (elem.width !== edge) elem.width = edge;
  if (elem.height !== edge) elem.height = edge;
}

function stampDisclaimerBanner(ctx: CanvasRenderingContext2D, resolution: number): void {
  const barHeight = Math.round(resolution * 0.075);
  ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
  ctx.fillRect(0, resolution - barHeight, resolution, barHeight);
  ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
  ctx.font = `${Math.round(barHeight * 0.46)}px system-ui, "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(DISCLAIMER, Math.round(resolution * 0.02), resolution - barHeight * 0.5);
}

export function paintSlice(
  canvas: HTMLCanvasElement,
  pixelArray: Uint8Array,
  resolution: number,
  basis: SliceBasis,
  plane: SlicePlane,
): void {
  ensureSurfaceDimensions(canvas, resolution);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const frameData = ctx.createImageData(resolution, resolution);
  const stride = resolution * 4;
  const invertRows = plane.cameraUp !== basis.down;
  const flipColumns = basis.right === -1;

  if (!flipColumns) {
    for (let r = 0; r < resolution; r++) {
      const sourceRow = invertRows ? resolution - 1 - r : r;
      const srcOffset = sourceRow * stride;
      frameData.data.set(pixelArray.subarray(srcOffset, srcOffset + stride), r * stride);
    }
  } else {
    const srcUint32 = new Uint32Array(pixelArray.buffer, pixelArray.byteOffset, resolution * resolution);
    const dstUint32 = new Uint32Array(frameData.data.buffer, frameData.data.byteOffset, resolution * resolution);

    for (let r = 0; r < resolution; r++) {
      const sourceRow = invertRows ? resolution - 1 - r : r;
      const srcRowBase = sourceRow * resolution;
      const dstRowBase = r * resolution;
      for (let c = 0; c < resolution; c++) {
        dstUint32[dstRowBase + c] = srcUint32[srcRowBase + (resolution - 1 - c)]!;
      }
    }
  }

  ctx.putImageData(frameData, 0, 0);
  stampDisclaimerBanner(ctx, resolution);
  activeSliceBuffer = ctx.getImageData(0, 0, resolution, resolution);
}

export function restoreSlice(canvas: HTMLCanvasElement): void {
  if (!activeSliceBuffer) return;
  ensureSurfaceDimensions(canvas, activeSliceBuffer.width);
  canvas.getContext("2d")?.putImageData(activeSliceBuffer, 0, 0);
}

export function forgetSlice(): void {
  activeSliceBuffer = null;
}

function drawCaliperMeasurement(
  ctx: CanvasRenderingContext2D,
  line: SectionMeasure,
  window: SliceWindow,
  dim: number,
  basis: SliceBasis,
): void {
  const pointA = pointOnScreen(window, line.ah, line.av, dim, basis);
  const pointB = pointOnScreen(window, line.bh, line.bv, dim, basis);

  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = Math.max(2, dim / 512);
  ctx.beginPath();
  ctx.moveTo(pointA.x, pointA.y);
  ctx.lineTo(pointB.x, pointB.y);
  ctx.stroke();

  const nodeRadius = Math.max(3, dim / 340);
  ctx.fillStyle = "#22d3ee";
  for (const node of [pointA, pointB]) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  const caption = formatDistance(measureCm(line));
  if (!caption) return;

  const textEm = Math.round(dim / 42);
  ctx.font = `${textEm}px system-ui, "Segoe UI", sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.lineWidth = Math.max(3, textEm * 0.2);
  ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
  ctx.fillStyle = "#a5f3fc";

  const posX = (pointA.x + pointB.x) * 0.5 + textEm * 0.6;
  const posY = (pointA.y + pointB.y) * 0.5 - textEm * 0.6;
  ctx.strokeText(caption, posX, posY);
  ctx.fillText(caption, posX, posY);
}

export async function sectionImage(
  window: SliceWindow,
  measures: readonly SectionMeasure[],
  basis: SliceBasis,
): Promise<string | null> {
  const baseCanvas = AXIAL_CANVAS.value;
  if (!baseCanvas || baseCanvas.width === 0) return null;

  const dimension = baseCanvas.width;
  const stagingCanvas = document.createElement("canvas");
  stagingCanvas.width = dimension;
  stagingCanvas.height = dimension;

  const ctx = stagingCanvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(baseCanvas, 0, 0);

  if (window.half > 0) {
    for (const m of measures) {
      drawCaliperMeasurement(ctx, m, window, dimension, basis);
    }
  }

  const imageBlob = await new Promise<Blob | null>((resolve) => stagingCanvas.toBlob(resolve, "image/png"));
  if (!imageBlob) return null;

  return encodeImageBytes(new Uint8Array(await imageBlob.arrayBuffer()));
}

export function sectionFileName(
  plane: SectionPlaneName,
  landmark: string | null,
  widthCm: number,
  isCut: boolean,
): string {
  const segments = ["hoomaan", plane];
  const safeLandmark = landmark?.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (safeLandmark) segments.push(safeLandmark);
  if (widthCm > 0) segments.push(`${Math.round(widthCm)}cm`);
  segments.push(isCut ? "cut" : "slab");
  return `${segments.join("-")}.png`;
}

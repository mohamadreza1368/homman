import * as THREE from "three";
import { DISCLAIMER, encodeImageBytes } from "./exportView";

/**
 * HOOMAAN Tomographic Section & Axial Slice Engine.
 * Provides orthographic slab and cut clipping planes, coordinate transforms,
 * magnification window calculations, calipers, and off-screen slice rendering.
 */

export const SLAB_HALF_THICKNESS = 0.004;

export type SectionPlaneName = "axial" | "front";

export interface SlicePlane {
  readonly name: SectionPlaneName;
  readonly normal: THREE.Vector3;
  readonly vertical: THREE.Vector3;
  readonly cameraUp: 1 | -1;
}

export const AXIAL_PLANE: SlicePlane = {
  name: "axial",
  normal: new THREE.Vector3(0, 1, 0),
  vertical: new THREE.Vector3(0, 0, 1),
  cameraUp: -1,
};

export const FRONT_PLANE: SlicePlane = {
  name: "front",
  normal: new THREE.Vector3(0, 0, 1),
  vertical: new THREE.Vector3(0, 1, 0),
  cameraUp: 1,
};

export function depthLabel(metresIn: number): string {
  const cm = Math.max(0, Math.round(metresIn * 100));
  return `${cm} cm deep`;
}

export function slicePlane(name: SectionPlaneName): SlicePlane {
  return name === "front" ? FRONT_PLANE : AXIAL_PLANE;
}

export function planePoint(plane: SlicePlane, h: number, v: number, at: number): THREE.Vector3 {
  return new THREE.Vector3(h, 0, 0)
    .addScaledVector(plane.vertical, v)
    .addScaledVector(plane.normal, at);
}

export function cameraUpOf(plane: SlicePlane): THREE.Vector3 {
  return plane.vertical.clone().multiplyScalar(plane.cameraUp);
}

export function cameraForwardOf(plane: SlicePlane): THREE.Vector3 {
  return plane.normal.clone().negate();
}

export function slabPlanes(
  plane: SlicePlane,
  at: number,
  half = SLAB_HALF_THICKNESS,
): THREE.Plane[] {
  return [
    new THREE.Plane(plane.normal.clone().negate(), at + half),
    new THREE.Plane(plane.normal.clone(), half - at),
  ];
}

export function cutPlanes(plane: SlicePlane, at: number): THREE.Plane[] {
  return [new THREE.Plane(plane.normal.clone().negate(), at)];
}

export const SLICE_MIN_HALF = 0.05;

export interface SliceWindow {
  h: number;
  v: number;
  half: number;
}

export function sliceWindowOf(box: THREE.Box3, plane: SlicePlane, margin = 1.06): SliceWindow {
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSpan = Math.max(size.x, size.dot(plane.vertical));
  const half = Math.max((maxSpan / 2) * margin, SLICE_MIN_HALF);

  return {
    h: centre.x,
    v: centre.dot(plane.vertical),
    half,
  };
}

export const SLICE_UP = cameraUpOf(AXIAL_PLANE);

export interface SliceBasis {
  right: 1 | -1;
  down: 1 | -1;
}

export function sliceBasis(leftSign: 1 | -1): SliceBasis {
  return { right: leftSign, down: -1 };
}

export const SLICE_FORWARD = cameraForwardOf(AXIAL_PLANE);

export const SLICE_PIXELS_NORMAL = 2048;
export const SLICE_PIXELS_HIGH = 4096;

export function sliceSize(high: boolean, maxTexture: number): number {
  const desired = high ? SLICE_PIXELS_HIGH : SLICE_PIXELS_NORMAL;
  if (!(maxTexture > 0)) return SLICE_PIXELS_NORMAL;
  return Math.min(desired, maxTexture);
}

export const SLICE_PIXELS = { value: SLICE_PIXELS_NORMAL };

export const SECTION_VIEW: { value: SliceWindow | null } = { value: null };

export const MIN_SECTION_HALF_M = 0.03;

function clampValue(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function containInBase(window: SliceWindow, base: SliceWindow): SliceWindow {
  const maxShift = Math.max(0, base.half - window.half);
  return {
    h: clampValue(window.h, base.h - maxShift, base.h + maxShift),
    v: clampValue(window.v, base.v - maxShift, base.v + maxShift),
    half: window.half,
  };
}

export function zoomWindow(
  frame: SliceWindow,
  base: SliceWindow,
  by: number,
  basis: SliceBasis,
  u = 0,
  v = 0,
): SliceWindow | null {
  if (!(by > 0) || !(base.half > 0)) return SECTION_VIEW.value;
  const newHalf = clampValue(frame.half / by, MIN_SECTION_HALF_M, base.half);
  if (newHalf >= base.half) return null;

  const focalH = frame.h + basis.right * u * frame.half;
  const focalV = frame.v + basis.down * v * frame.half;

  return containInBase(
    {
      h: focalH - basis.right * u * newHalf,
      v: focalV - basis.down * v * newHalf,
      half: newHalf,
    },
    base,
  );
}

export function panWindow(
  frame: SliceWindow,
  base: SliceWindow,
  dxPx: number,
  dyPx: number,
  windowPx: number,
  basis: SliceBasis,
): SliceWindow | null {
  if (!(windowPx > 0)) return SECTION_VIEW.value;
  const scale = (2 * frame.half) / windowPx;

  return containInBase(
    {
      h: frame.h - basis.right * dxPx * scale,
      v: frame.v - basis.down * dyPx * scale,
      half: frame.half,
    },
    base,
  );
}

export interface SectionMeasure {
  ah: number;
  av: number;
  bh: number;
  bv: number;
  at: number;
  plane: SectionPlaneName;
}

export const MEASURE_LEVEL_TOLERANCE_M = 0.005;

export function onLevel(
  line: Pick<SectionMeasure, "at" | "plane">,
  at: number,
  plane: SectionPlaneName,
): boolean {
  return line.plane === plane && Math.abs(line.at - at) <= MEASURE_LEVEL_TOLERANCE_M;
}

export function pointInSection(
  window: SliceWindow,
  offsetXPx: number,
  offsetYPx: number,
  windowPx: number,
  basis: SliceBasis,
): { h: number; v: number } {
  const pixelToMeter = (2 * window.half) / windowPx;
  return {
    h: window.h + basis.right * (offsetXPx - windowPx / 2) * pixelToMeter,
    v: window.v + basis.down * (offsetYPx - windowPx / 2) * pixelToMeter,
  };
}

export function pointOnScreen(
  window: SliceWindow,
  h: number,
  v: number,
  windowPx: number,
  basis: SliceBasis,
): { x: number; y: number } {
  if (!(window.half > 0)) return { x: 0, y: 0 };
  const meterToPixel = windowPx / (2 * window.half);
  return {
    x: windowPx / 2 + basis.right * (h - window.h) * meterToPixel,
    y: windowPx / 2 + basis.down * (v - window.v) * meterToPixel,
  };
}

export function measureCm(line: Pick<SectionMeasure, "ah" | "av" | "bh" | "bv">): number {
  return Math.hypot(line.bh - line.ah, line.bv - line.av) * 100;
}

export function formatDistance(cm: number): string {
  if (!(cm > 0)) return "";
  if (cm < 1) return `${Math.round(cm * 10)} mm`;
  return `${cm.toFixed(1)} cm`;
}

export const SECTION_WINDOW = "min(90vh, calc(100vw - 23rem))";
export const SECTION_WANTED = { value: 0 };

export function wantSection(): void {
  SECTION_WANTED.value += 1;
}

export const WHEEL_PER_STEP = 100;

export function wheelPixels(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1 || deltaMode === 2) {
    return Math.sign(deltaY) * WHEEL_PER_STEP;
  }
  return deltaY;
}

export function wheelSteps(
  carried: number,
  deltaY: number,
  perStep: number = WHEEL_PER_STEP,
): { steps: number; carry: number } {
  const reversed = carried !== 0 && deltaY !== 0 && carried > 0 !== deltaY > 0;
  const total = reversed ? deltaY : carried + deltaY;
  const steps = Math.trunc(total / perStep);
  return { steps, carry: total - steps * perStep };
}

export const WHEEL_SETTLE_MS = 130;

const TORCH_LOWEST = (8 * Math.PI) / 180;

export function torchDirection(
  u: number,
  v: number,
  basis: SliceBasis,
  plane: SlicePlane,
): THREE.Vector3 {
  const dist = Math.min(1, Math.hypot(u, v));
  const normalVec = plane.normal.clone();
  if (dist < 1e-6) return normalVec;

  const lateral = new THREE.Vector3(basis.right * u, 0, 0)
    .addScaledVector(plane.vertical, basis.down * v)
    .normalize();
  const pitch = TORCH_LOWEST + (1 - dist) * (Math.PI / 2 - TORCH_LOWEST);

  return lateral
    .multiplyScalar(Math.cos(pitch))
    .addScaledVector(normalVec, Math.sin(pitch))
    .normalize();
}

export const TORCH: { value: THREE.Vector3 | null } = { value: null };
export const RETAKE_INTERVAL_MS = 70;
export const AXIAL_CANVAS: { value: HTMLCanvasElement | null } = { value: null };

let cachedSliceImageData: ImageData | null = null;

function syncCanvasSize(canvas: HTMLCanvasElement, size: number): void {
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
}

function renderSliceDisclaimer(context: CanvasRenderingContext2D, size: number): void {
  const bannerHeight = Math.round(size * 0.075);
  context.fillStyle = "rgba(2, 6, 23, 0.82)";
  context.fillRect(0, size - bannerHeight, size, bannerHeight);
  context.fillStyle = "rgba(148, 163, 184, 0.9)";
  context.font = `${Math.round(bannerHeight * 0.46)}px system-ui, "Segoe UI", sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillText(DISCLAIMER, Math.round(size * 0.02), size - bannerHeight / 2);
}

export function paintSlice(
  canvas: HTMLCanvasElement,
  pixels: Uint8Array,
  size: number,
  basis: SliceBasis,
  plane: SlicePlane,
): void {
  syncCanvasSize(canvas, size);
  const context = canvas.getContext("2d");
  if (!context) return;

  const imageData = context.createImageData(size, size);
  const rowBytes = size * 4;
  const flip = plane.cameraUp !== basis.down;
  const mirror = basis.right === -1;

  const src32 = mirror ? new Uint32Array(pixels.buffer, pixels.byteOffset, size * size) : null;
  const dst32 = mirror
    ? new Uint32Array(imageData.data.buffer, imageData.data.byteOffset, size * size)
    : null;

  for (let y = 0; y < size; y++) {
    const srcY = flip ? size - 1 - y : y;
    if (!src32 || !dst32) {
      imageData.data.set(
        pixels.subarray(srcY * rowBytes, srcY * rowBytes + rowBytes),
        y * rowBytes,
      );
      continue;
    }
    const sOffset = srcY * size;
    const dOffset = y * size;
    for (let x = 0; x < size; x++) {
      dst32[dOffset + x] = src32[sOffset + size - 1 - x]!;
    }
  }

  context.putImageData(imageData, 0, 0);
  renderSliceDisclaimer(context, size);
  cachedSliceImageData = context.getImageData(0, 0, size, size);
}

export function restoreSlice(canvas: HTMLCanvasElement): void {
  if (!cachedSliceImageData) return;
  syncCanvasSize(canvas, cachedSliceImageData.width);
  const context = canvas.getContext("2d");
  context?.putImageData(cachedSliceImageData, 0, 0);
}

export function forgetSlice(): void {
  cachedSliceImageData = null;
}

function renderMeasureOverlay(
  context: CanvasRenderingContext2D,
  line: SectionMeasure,
  window: SliceWindow,
  size: number,
  basis: SliceBasis,
): void {
  const pA = pointOnScreen(window, line.ah, line.av, size, basis);
  const pB = pointOnScreen(window, line.bh, line.bv, size, basis);

  context.strokeStyle = "#22d3ee";
  context.lineWidth = Math.max(2, size / 512);
  context.beginPath();
  context.moveTo(pA.x, pA.y);
  context.lineTo(pB.x, pB.y);
  context.stroke();

  const radius = Math.max(3, size / 340);
  context.fillStyle = "#22d3ee";
  for (const pt of [pA, pB]) {
    context.beginPath();
    context.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const label = formatDistance(measureCm(line));
  if (!label) return;

  const fontSize = Math.round(size / 42);
  context.font = `${fontSize}px system-ui, "Segoe UI", sans-serif`;
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  context.lineWidth = Math.max(3, fontSize / 5);
  context.strokeStyle = "rgba(2, 6, 23, 0.9)";
  context.fillStyle = "#a5f3fc";

  const tx = (pA.x + pB.x) / 2 + fontSize * 0.6;
  const ty = (pA.y + pB.y) / 2 - fontSize * 0.6;
  context.strokeText(label, tx, ty);
  context.fillText(label, tx, ty);
}

export async function sectionImage(
  window: SliceWindow,
  lines: readonly SectionMeasure[],
  basis: SliceBasis,
): Promise<string | null> {
  const srcCanvas = AXIAL_CANVAS.value;
  if (!srcCanvas || srcCanvas.width === 0) return null;

  const size = srcCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(srcCanvas, 0, 0);

  if (window.half > 0) {
    for (const measure of lines) {
      renderMeasureOverlay(context, measure, window, size, basis);
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return null;

  return encodeImageBytes(new Uint8Array(await blob.arrayBuffer()));
}

export function sectionFileName(
  plane: SectionPlaneName,
  where: string | null,
  acrossCm: number,
  cut: boolean,
): string {
  const parts = ["hoomaan", plane];
  const cleanedLoc = where?.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (cleanedLoc) parts.push(cleanedLoc);
  if (acrossCm > 0) parts.push(`${Math.round(acrossCm)}cm`);
  parts.push(cut ? "cut" : "slab");
  return `${parts.join("-")}.png`;
}

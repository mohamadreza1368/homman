/**
 * Hoomaan 3D Viewer - Realtime Render Performance & Diagnostics Profiler
 */

const WINDOW_SIZE = 120;

export interface RenderSample {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  visible: number;
  objects: number;
  canvases: number;
  heapMb: number | null;
  meanMs: number;
  p95Ms: number;
}

export const EMPTY_SAMPLE: RenderSample = {
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  visible: 0,
  objects: 0,
  canvases: 0,
  heapMb: null,
  meanMs: 0,
  p95Ms: 0,
};

export const sample: RenderSample = { ...EMPTY_SAMPLE };

const frameBuffer: number[] = [];
let bufferIndex = 0;

/** Records duration of a frame and updates rolling statistics. */
export function noteFrame(ms: number): void {
  if (ms > 1000) return;

  if (frameBuffer.length < WINDOW_SIZE) {
    frameBuffer.push(ms);
  } else {
    frameBuffer[bufferIndex] = ms;
    bufferIndex = (bufferIndex + 1) % WINDOW_SIZE;
  }

  let sum = 0;
  for (const f of frameBuffer) sum += f;
  sample.meanMs = sum / frameBuffer.length;

  const sorted = [...frameBuffer].sort((a, b) => a - b);
  sample.p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

/** Resets rolling timing history. */
export function resetFrames(): void {
  frameBuffer.length = 0;
  bufferIndex = 0;
  sample.meanMs = 0;
  sample.p95Ms = 0;
}

/** Computes average FPS from sample frame timing. */
export function fps(of: RenderSample): number {
  return of.meanMs > 0 ? 1000 / of.meanMs : 0;
}

/** Returns current JS heap usage in megabytes when supported by engine. */
export function heapMb(): number | null {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
  const bytes = perf.memory?.usedJSHeapSize;
  return typeof bytes === "number" ? bytes / 1048576 : null;
}

/**
 * Raycast traversal stack and depth profiling along line-of-sight in HOOMAAN.
 *
 * Extracts internal anatomical layers crossed by the raycast cursor, orders them from
 * superficial to deep, calculates depth-based visual attenuation, and provides
 * transient click-through event coordination.
 */
export const MAX_STACK = 12;
export const PROBE_REACH = 6;
export const LIT_DIMMEST = 0.55;

export function probeGlow(depth: number): number {
  if (!Number.isFinite(depth) || depth < 0 || depth >= PROBE_REACH) return 0;
  return 1 - depth / PROBE_REACH;
}

export function illuminationGlow(index: number, count: number): number {
  if (!Number.isFinite(index) || index < 0 || index >= count) return 0;
  if (count <= 1) return 1;
  return 1 - (index / (count - 1)) * (1 - LIT_DIMMEST);
}

interface IntersectedTarget {
  object: { userData?: Record<string, unknown> };
}

export function stackFromCrossings(crossings: Iterable<IntersectedTarget>): string[] {
  const seenIds = new Set<string>();
  const stack: string[] = [];

  for (const item of crossings) {
    const id = item.object?.userData?.organId;
    if (typeof id !== "string" || seenIds.has(id)) continue;
    seenIds.add(id);
    stack.push(id);
    if (stack.length >= MAX_STACK) break;
  }
  return stack;
}

export function sameStack(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((id, idx) => id === b[idx]);
}

let depthReportFlag = false;

export function reportDepthStack(): void {
  depthReportFlag = true;
}

export function consumeDepthStackReport(): boolean {
  const prev = depthReportFlag;
  depthReportFlag = false;
  return prev;
}

let clickProcessedFlag = false;

export function reportClick(): void {
  clickProcessedFlag = true;
}

export function consumeClickReport(): boolean {
  const prev = clickProcessedFlag;
  clickProcessedFlag = false;
  return prev;
}

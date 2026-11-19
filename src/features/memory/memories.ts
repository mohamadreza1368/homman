import type { SessionSummary, StudyNote } from "@/lib/studyDb";

export type MemoryKind = "session" | "case" | "note";

export interface Memory {
  key: string;
  kind: MemoryKind;
  id: string;
  title: string;
  at: number;
  structures: number;
  preview: string;
}

const PREVIEW_MAX_LEN = 140;

function generateExcerpt(content: string, cap = PREVIEW_MAX_LEN): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= cap) {
    return normalized;
  }
  return `${normalized.slice(0, cap - 1)}…`;
}

/**
 * Transforms study sessions and clinical notes into a chronologically ordered memory stream.
 */
export function memoriesFrom(
  sessions: readonly SessionSummary[],
  notes: readonly StudyNote[],
): Memory[] {
  const collection: Memory[] = [];

  for (const sess of sessions) {
    const isClinicalCase = sess.kind === "case";
    let summaryText: string;

    if (isClinicalCase && sess.score !== null) {
      summaryText = `Case visit · scored ${sess.score}`;
    } else {
      summaryText = `${sess.message_count} messages · ${sess.structure_count} structures`;
    }

    collection.push({
      key: `session:${sess.id}`,
      kind: isClinicalCase ? "case" : "session",
      id: sess.id,
      title: sess.title,
      at: sess.created_at,
      structures: sess.structure_count,
      preview: summaryText,
    });
  }

  for (const entry of notes) {
    collection.push({
      key: `note:${entry.id}`,
      kind: "note",
      id: String(entry.id),
      title: entry.organ_label ? `Note on ${entry.organ_label}` : "Note",
      at: entry.created_at,
      structures: entry.organ_id ? 1 : 0,
      preview: generateExcerpt(entry.body),
    });
  }

  return collection.sort((m1, m2) => m1.at - m2.at || m1.key.localeCompare(m2.key));
}

/**
 * Aggregates frequency count by memory classification kind.
 */
export function tally(records: readonly Memory[]): Record<MemoryKind, number> {
  const summary: Record<MemoryKind, number> = { session: 0, case: 0, note: 0 };
  for (const item of records) {
    summary[item.kind] += 1;
  }
  return summary;
}

/**
 * Produces an unbroken month-by-month distribution array between the oldest and newest memory.
 */
export function byMonth(records: readonly Memory[]): { month: string; count: number }[] {
  if (records.length === 0) {
    return [];
  }

  const computeMonthKey = (epochMs: number) => {
    const dateObj = new Date(epochMs);
    return dateObj.getFullYear() * 12 + dateObj.getMonth();
  };

  const startBucket = computeMonthKey(records[0]!.at);
  const endBucket = computeMonthKey(records[records.length - 1]!.at);

  const bucketCounts = new Map<number, number>();
  for (const item of records) {
    const bId = computeMonthKey(item.at);
    bucketCounts.set(bId, (bucketCounts.get(bId) ?? 0) + 1);
  }

  const timeline: { month: string; count: number }[] = [];
  for (let idx = startBucket; idx <= endBucket; idx++) {
    const epochDate = new Date(Math.floor(idx / 12), idx % 12, 1);
    const labelStr = epochDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    timeline.push({
      month: labelStr,
      count: bucketCounts.get(idx) ?? 0,
    });
  }

  return timeline;
}

/**
 * Projects a sequence of memory indices onto closest coordinate points of a cerebral cortex mesh.
 */
export function placeOnCortex(count: number, surfaceCoordinates: ArrayLike<number>): number[] {
  const vertexCount = Math.floor(surfaceCoordinates.length / 3);
  if (count <= 0 || vertexCount <= 0) {
    return [];
  }

  const radii = new Float32Array(vertexCount);
  for (let v = 0; v < vertexCount; v++) {
    const vx = surfaceCoordinates[v * 3]!;
    const vy = surfaceCoordinates[v * 3 + 1]!;
    const vz = surfaceCoordinates[v * 3 + 2]!;
    radii[v] = Math.hypot(vx, vy, vz) || 1;
  }

  const mappedIndices = new Set<number>();
  const mapping: number[] = [];

  for (let step = 0; step < count; step++) {
    const progress = count === 1 ? 0.5 : step / (count - 1);
    const elevation = -0.25 + progress * 0.95;
    const azimuth = Math.PI + progress * Math.PI * 4;
    const planarRadius = Math.sqrt(Math.max(0, 1 - elevation * elevation));

    const targetDirX = Math.sin(azimuth) * planarRadius;
    const targetDirY = elevation;
    const targetDirZ = Math.cos(azimuth) * planarRadius;

    let optimalVertex = -1;
    let highestScore = -Infinity;

    for (let v = 0; v < vertexCount; v++) {
      const px = surfaceCoordinates[v * 3]!;
      const py = surfaceCoordinates[v * 3 + 1]!;
      const pz = surfaceCoordinates[v * 3 + 2]!;

      const alignment = (px * targetDirX + py * targetDirY + pz * targetDirZ) / radii[v]!;
      const penalty = mappedIndices.has(v) ? 0.05 : 0;
      const finalScore = alignment - penalty;

      if (finalScore > highestScore) {
        highestScore = finalScore;
        optimalVertex = v;
      }
    }

    mappedIndices.add(optimalVertex);
    mapping.push(optimalVertex);
  }

  return mapping;
}

/**
 * Navigates linearly forwards or backwards across active memory keys without cyclic wrapping.
 */
export function stepMemory(
  orderedKeys: readonly string[],
  activeKey: string | null,
  offset: -1 | 1,
): string | null {
  if (orderedKeys.length === 0) {
    return null;
  }

  const currentIndex = activeKey === null ? -1 : orderedKeys.indexOf(activeKey);
  if (currentIndex === -1) {
    return offset === -1 ? orderedKeys[orderedKeys.length - 1]! : orderedKeys[0]!;
  }

  const nextIndex = Math.min(orderedKeys.length - 1, Math.max(0, currentIndex + offset));
  return orderedKeys[nextIndex]!;
}

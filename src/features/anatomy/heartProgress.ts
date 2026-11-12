export interface HeartProgress { lastStep: number; visited: number[]; attempts: number; best: number | null; last: number | null }
export const HEART_PROGRESS_KEY = "homman.heart-lesson.v1";
export const emptyHeartProgress = (): HeartProgress => ({ lastStep: 0, visited: [], attempts: 0, best: null, last: null });

export function parseHeartProgress(raw: unknown, stepCount: number, questionCount: number): HeartProgress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyHeartProgress();
  const p = raw as Partial<HeartProgress>;
  const validScore = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= questionCount;
  const visited = Array.isArray(p.visited) ? [...new Set(p.visited.filter((n) => Number.isInteger(n) && n >= 0 && n < stepCount))] : [];
  return { lastStep: Number.isInteger(p.lastStep) && p.lastStep! >= 0 && p.lastStep! < stepCount ? p.lastStep! : 0, visited,
    attempts: Number.isSafeInteger(p.attempts) && p.attempts! >= 0 ? p.attempts! : 0, best: validScore(p.best) ? p.best : null, last: validScore(p.last) ? p.last : null };
}

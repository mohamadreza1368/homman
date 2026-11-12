export interface ReviewProgress { attempts: number; correct: number; streak: number; dueAt: number }
export type ReviewRecords = Record<string, ReviewProgress>;
const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

/** A simple educational schedule, not a prediction of mastery. */
export function recordAnswer(previous: ReviewProgress | undefined, correct: boolean, now: number): ReviewProgress {
  const streak = correct ? (previous?.streak ?? 0) + 1 : 0;
  return { attempts: (previous?.attempts ?? 0) + 1, correct: (previous?.correct ?? 0) + Number(correct), streak,
    dueAt: now + (correct ? INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)]! : 10 * 60 * 1000) };
}

/** Due questions first, then new questions, then the next upcoming question. */
export function nextReview(ids: string[], records: ReviewRecords, now: number): string | undefined {
  const due = ids.filter((id) => records[id] && records[id]!.dueAt <= now).sort((a, b) => records[a]!.dueAt - records[b]!.dueAt);
  return due[0] ?? ids.find((id) => !records[id]) ?? [...ids].sort((a, b) => records[a]!.dueAt - records[b]!.dueAt)[0];
}

export function parseReviewRecords(value: unknown): ReviewRecords {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const valid: ReviewRecords = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<ReviewProgress>;
    if (!Number.isSafeInteger(item.attempts) || !Number.isSafeInteger(item.correct) || item.attempts! < 0 || item.correct! < 0 || item.correct! > item.attempts!) continue;
    // Old practice records have no schedule; make them due now without losing counts.
    valid[key] = { attempts: item.attempts!, correct: item.correct!, streak: Number.isSafeInteger(item.streak) && item.streak! >= 0 ? item.streak! : 0,
      dueAt: typeof item.dueAt === "number" && Number.isFinite(item.dueAt) && item.dueAt >= 0 ? item.dueAt : 0 };
  }
  return valid;
}

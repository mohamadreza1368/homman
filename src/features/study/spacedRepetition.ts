/**
 * Hoomaan Spaced Repetition Engine
 * Implements the standard SuperMemo-2 (SM-2) memory consolidation algorithm.
 *
 * Derived purely from behavioral specifications in specs/study-spaced-repetition.md.
 */

export type UserReviewRating = 0 | 1 | 2 | 3 | 4 | 5;

export interface MemoryScheduleState {
  repetitionCount: number;
  intervalDays: number;
  easeFactor: number;
}

export interface ReviewScheduleOutput {
  repetitionCount: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewDate: Date;
}

const MINIMUM_EASE_FACTOR = 1.3;
const DEFAULT_INITIAL_EASE = 2.5;

/**
 * Calculates the next review interval and updated ease factor based on
 * the user's recall quality (0 to 5) according to standard SM-2.
 */
export function computeNextReviewSchedule(
  current: MemoryScheduleState,
  rating: UserReviewRating,
  baseDate: Date = new Date(),
): ReviewScheduleOutput {
  const isSuccessfulRecall = rating >= 3;

  let nextRepetition: number;
  let nextInterval: number;

  if (!isSuccessfulRecall) {
    // Recall failure: reset repetition sequence back to the beginning
    nextRepetition = 0;
    nextInterval = 1;
  } else {
    // Successful recall: increment interval according to repetition stage
    if (current.repetitionCount === 0) {
      nextRepetition = 1;
      nextInterval = 1;
    } else if (current.repetitionCount === 1) {
      nextRepetition = 2;
      nextInterval = 6;
    } else {
      nextRepetition = current.repetitionCount + 1;
      nextInterval = Math.round(current.intervalDays * current.easeFactor);
    }
  }

  // SM-2 Ease Factor formula:
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const deltaFactor = 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02);
  const updatedEase = Number((current.easeFactor + deltaFactor).toFixed(2));
  const boundedEase = Math.max(MINIMUM_EASE_FACTOR, updatedEase);

  const nextDate = new Date(baseDate.getTime());
  nextDate.setDate(nextDate.getDate() + nextInterval);

  return {
    repetitionCount: nextRepetition,
    intervalDays: nextInterval,
    easeFactor: boundedEase,
    nextReviewDate: nextDate,
  };
}

/**
 * Creates a pristine initial memory schedule for an unstudied anatomical card.
 */
export function createInitialSchedule(): MemoryScheduleState {
  return {
    repetitionCount: 0,
    intervalDays: 0,
    easeFactor: DEFAULT_INITIAL_EASE,
  };
}

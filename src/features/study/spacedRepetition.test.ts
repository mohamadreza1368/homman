import { describe, expect, it } from "vitest";
import {
  computeNextReviewSchedule,
  createInitialSchedule,
} from "./spacedRepetition";

describe("Spaced Repetition SM-2 (Specs-Derived Behavioral Tests)", () => {
  const referenceDate = new Date("2026-11-20T10:00:00.000Z");

  it("Scenario 1: First encounter with a new card and rating of 4", () => {
    const initial = createInitialSchedule();
    const result = computeNextReviewSchedule(initial, 4, referenceDate);

    expect(result.repetitionCount).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.easeFactor).toBe(2.5);

    const expectedDate = new Date("2026-11-21T10:00:00.000Z");
    expect(result.nextReviewDate.toISOString()).toBe(expectedDate.toISOString());
  });

  it("Scenario 2: Second repetition with rating of 5", () => {
    const current = {
      repetitionCount: 1,
      intervalDays: 1,
      easeFactor: 2.5,
    };
    const result = computeNextReviewSchedule(current, 5, referenceDate);

    expect(result.repetitionCount).toBe(2);
    expect(result.intervalDays).toBe(6);
    expect(result.easeFactor).toBe(2.6);

    const expectedDate = new Date("2026-11-26T10:00:00.000Z");
    expect(result.nextReviewDate.toISOString()).toBe(expectedDate.toISOString());
  });

  it("Scenario 3: Third repetition with rating of 4", () => {
    const current = {
      repetitionCount: 2,
      intervalDays: 6,
      easeFactor: 2.6,
    };
    const result = computeNextReviewSchedule(current, 4, referenceDate);

    expect(result.repetitionCount).toBe(3);
    expect(result.intervalDays).toBe(16); // round(6 * 2.6) = 16
    expect(result.easeFactor).toBe(2.6);

    const expectedDate = new Date("2026-12-06T10:00:00.000Z");
    expect(result.nextReviewDate.toISOString()).toBe(expectedDate.toISOString());
  });

  it("Scenario 4: Recall failure (rating of 1) resets repetition count", () => {
    const current = {
      repetitionCount: 4,
      intervalDays: 32,
      easeFactor: 2.4,
    };
    const result = computeNextReviewSchedule(current, 1, referenceDate);

    expect(result.repetitionCount).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.easeFactor).toBe(1.86);

    const expectedDate = new Date("2026-11-21T10:00:00.000Z");
    expect(result.nextReviewDate.toISOString()).toBe(expectedDate.toISOString());
  });

  it("Edge Case A: Ease factor never drops below minimum threshold of 1.3", () => {
    let state = {
      repetitionCount: 3,
      intervalDays: 10,
      easeFactor: 1.4,
    };

    // Multiple consecutive severe recall failures (rating 0)
    for (let i = 0; i < 5; i++) {
      const outcome = computeNextReviewSchedule(state, 0, referenceDate);
      state = {
        repetitionCount: outcome.repetitionCount,
        intervalDays: outcome.intervalDays,
        easeFactor: outcome.easeFactor,
      };
      expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
    }

    expect(state.easeFactor).toBe(1.3);
    expect(state.intervalDays).toBe(1);
  });
});

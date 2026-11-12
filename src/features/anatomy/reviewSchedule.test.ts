import { expect, it } from "vitest";
import { nextReview, parseReviewRecords, recordAnswer } from "./reviewSchedule";

it("schedules correct answers further apart and incorrect answers sooner", () => {
  const start = 1_000_000;
  const first = recordAnswer(undefined, true, start);
  const second = recordAnswer(first, true, start + 1);
  const wrong = recordAnswer(second, false, start + 2);
  expect(first.dueAt - start).toBe(86_400_000);
  expect(second.dueAt - (start + 1)).toBe(3 * 86_400_000);
  expect(wrong.dueAt - (start + 2)).toBe(600_000);
  expect(wrong.streak).toBe(0);
  expect(wrong.attempts).toBe(3);
});

it("prioritizes due questions and retains counts from old records", () => {
  const records = parseReviewRecords({ old: { attempts: 5, correct: 3 }, future: { attempts: 1, correct: 1, streak: 1, dueAt: 5000 }, bad: { attempts: -1, correct: 0 } });
  expect(records.old).toEqual({ attempts: 5, correct: 3, streak: 0, dueAt: 0 });
  expect(records.bad).toBeUndefined();
  expect(nextReview(["future", "new", "old"], records, 1000)).toBe("old");
  expect(nextReview(["future", "new"], records, 1000)).toBe("new");
  expect(nextReview(["future"], records, 1000)).toBe("future");
});

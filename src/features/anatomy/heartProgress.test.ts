import { expect, it } from "vitest";
import { parseHeartProgress } from "./heartProgress";

it("keeps valid progress and rejects malformed steps and scores", () => {
  expect(parseHeartProgress({ lastStep: 3, visited: [0, 3, 3, 7, -1], attempts: 2, best: 4, last: 3 }, 6, 4))
    .toEqual({ lastStep: 3, visited: [0, 3], attempts: 2, best: 4, last: 3 });
  expect(parseHeartProgress({ lastStep: 99, visited: "bad", attempts: -1, best: 5, last: -1 }, 6, 4))
    .toEqual({ lastStep: 0, visited: [], attempts: 0, best: null, last: null });
});

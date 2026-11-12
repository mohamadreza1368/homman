import { expect, it } from "vitest";

import { nameplateText } from "./ScanRing";

it("names the instrument, whose hand is on it, and which way it reads", () => {
  expect(nameplateText(false)).toBe("HOMMAN");
  expect(nameplateText(true)).toBe("HOMMAN AI");
  expect(nameplateText(false, "front")).toBe("HOMMAN FRONT");
  expect(nameplateText(true, "front")).toBe("HOMMAN AI FRONT");
});

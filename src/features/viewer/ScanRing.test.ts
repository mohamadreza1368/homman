import { expect, it } from "vitest";

import { nameplateText } from "./ScanRing";

it("names the instrument, whose hand is on it, and which way it reads", () => {
  expect(nameplateText(false)).toBe("HOOMAAN");
  expect(nameplateText(true)).toBe("HOOMAAN AI");
  expect(nameplateText(false, "front")).toBe("HOOMAAN FRONT");
  expect(nameplateText(true, "front")).toBe("HOOMAAN AI FRONT");
});

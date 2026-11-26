import { describe, expect, it } from "vitest";
import { SURFACE_LANDMARKS_CATALOG, landmarksForOrgan } from "./surfaceLandmarksCatalog";

describe("surfaceLandmarksCatalog", () => {
  it("contains TA2 bony landmarks with normalized [0..1] bounding box coordinates", () => {
    expect(SURFACE_LANDMARKS_CATALOG.length).toBeGreaterThanOrEqual(12);
    for (const lm of SURFACE_LANDMARKS_CATALOG) {
      expect(lm.ta2Id).toMatch(/^TA2:\d+/);
      for (const coord of lm.normalizedBoxPos) {
        expect(coord).toBeGreaterThanOrEqual(0);
        expect(coord).toBeLessThanOrEqual(1);
      }
    }
  });

  it("returns Greater Trochanter and Lesser Trochanter for femur_l", () => {
    const femurLandmarks = landmarksForOrgan("femur_l");
    expect(femurLandmarks.some((l) => l.ta2Latin === "Trochanter major")).toBe(true);
    expect(femurLandmarks.some((l) => l.ta2Latin === "Trochanter minor")).toBe(true);
  });
});

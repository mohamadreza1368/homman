import { describe, expect, it } from "vitest";
import { getMuscleProfile, CLINICAL_MUSCLE_CATALOG } from "./muscleCatalog";

describe("muscleCatalog (O/I/I/A Engine)", () => {
  it("resolves major clinical muscles accurately with both left and right laterality", () => {
    const bicepsL = getMuscleProfile("biceps_brachii_l");
    const bicepsR = getMuscleProfile("biceps_brachii_r");
    expect(bicepsL).toBeDefined();
    expect(bicepsR).toBeDefined();
    expect(bicepsL?.nameEn).toBe("Biceps brachii");
    expect(bicepsL?.spinalRoots).toEqual(["C5", "C6"]);
    expect(bicepsL?.innervationFa).toContain("موسکولوکوتانئوس");

    const triceps = getMuscleProfile("triceps_brachii_l");
    expect(triceps).toBeDefined();
    expect(triceps?.spinalRoots).toContain("C7");

    const deltoid = getMuscleProfile("deltoid_l");
    expect(deltoid).toBeDefined();
    expect(deltoid?.actionFa).toContain("ابداکتور");

    const gastrocnemius = getMuscleProfile("gastrocnemius_l");
    expect(gastrocnemius).toBeDefined();
    expect(gastrocnemius?.spinalRoots).toContain("S1");
    expect(gastrocnemius?.clinicalTestFa).toContain("آشیل");
  });

  it("returns undefined for non-muscle structures", () => {
    expect(getMuscleProfile("femur_l")).toBeUndefined();
    expect(getMuscleProfile("kidney_r")).toBeUndefined();
  });

  it("has complete O/I/I/A data for all catalog entries", () => {
    for (const muscle of CLINICAL_MUSCLE_CATALOG) {
      expect(muscle.originFa.length).toBeGreaterThan(0);
      expect(muscle.originEn.length).toBeGreaterThan(0);
      expect(muscle.insertionFa.length).toBeGreaterThan(0);
      expect(muscle.insertionEn.length).toBeGreaterThan(0);
      expect(muscle.innervationFa.length).toBeGreaterThan(0);
      expect(muscle.actionFa.length).toBeGreaterThan(0);
      expect(muscle.clinicalTestFa.length).toBeGreaterThan(0);
      expect(muscle.spinalRoots.length).toBeGreaterThan(0);
    }
  });
});

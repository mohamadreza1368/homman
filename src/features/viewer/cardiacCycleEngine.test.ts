import { describe, expect, it } from "vitest";
import {
  evaluateChamberKinematics,
  evaluateEcgSignalVoltage,
} from "./cardiacCycleEngine";

describe("Cardiac Motion & ECG (Specs-Derived Behavioral Tests)", () => {
  it("Scenario 1: Atrial contraction peak around 0.05s while ventricles rest", () => {
    const state = evaluateChamberKinematics(0.05, "normal");

    // Atria should be near maximum squeeze of 0.08
    expect(state.atrialContraction).toBeCloseTo(0.08, 2);
    // Ventricles should be at 0 (rest phase)
    expect(state.ventricularContraction).toBe(0);
  });

  it("Scenario 2: Ventricular contraction peak around 0.26s while atria rest", () => {
    const state = evaluateChamberKinematics(0.26, "normal");

    expect(state.atrialContraction).toBe(0);
    expect(state.ventricularContraction).toBeCloseTo(0.08, 2);
  });

  it("Scenario 3: Rest in diastole at 0.6s", () => {
    const state = evaluateChamberKinematics(0.6, "normal");

    expect(state.atrialContraction).toBe(0);
    expect(state.ventricularContraction).toBe(0);
  });

  it("Scenario 4: ECG voltage peak at R wave exceeds 0.7", () => {
    // R-wave occurs around 0.20s in the normalized cycle
    const voltage = evaluateEcgSignalVoltage(0.20, "normal");
    expect(voltage).toBeGreaterThan(0.7);
  });

  it("Edge Case A: Asystole has zero contraction and a flat ECG line", () => {
    const state = evaluateChamberKinematics(0.26, "asystole");
    expect(state.atrialContraction).toBe(0);
    expect(state.ventricularContraction).toBe(0);

    const voltage = evaluateEcgSignalVoltage(0.20, "asystole");
    expect(Math.abs(voltage)).toBeLessThan(0.01);
  });

  it("Edge Case B: Ventricular Fibrillation exhibits small tremor but never full squeeze", () => {
    const state = evaluateChamberKinematics(0.26, "ventricular_fibrillation");

    // Quivering is active (> 0) but bounded far below full squeeze
    expect(state.ventricularContraction).toBeGreaterThan(0);
    expect(state.ventricularContraction).toBeLessThan(0.05);
  });
});

import { describe, expect, it } from "vitest";
import {
  enterIsolationMode,
  getNextTransparencyStep,
  removeOrganFromIsolation,
  resolveOrganSelection,
} from "./selectionEngine";

describe("Viewport Interaction & Selection (Specs-Derived Behavioral Tests)", () => {
  it("Scenario 1: Single click replaces selection with picked organ", () => {
    const current = new Set(["aorta"]);
    const updated = resolveOrganSelection(current, "left_ventricle", false);

    expect(Array.from(updated)).toEqual(["left_ventricle"]);
  });

  it("Scenario 2: Shift+click adds new organ to existing selection", () => {
    const current = new Set(["left_ventricle"]);
    const updated = resolveOrganSelection(current, "right_ventricle", true);

    expect(Array.from(updated).sort()).toEqual(["left_ventricle", "right_ventricle"]);
  });

  it("Scenario 3: Shift+click on already selected organ removes it", () => {
    const current = new Set(["left_ventricle", "right_ventricle"]);
    const updated = resolveOrganSelection(current, "left_ventricle", true);

    expect(Array.from(updated)).toEqual(["right_ventricle"]);
  });

  it("Scenario 4: Cycling layer opacity through distinct transparency stops", () => {
    let step = getNextTransparencyStep(1.0);
    expect(step).toBe(0.28);

    step = getNextTransparencyStep(step);
    expect(step).toBe(0.12);

    step = getNextTransparencyStep(step);
    expect(step).toBe(1.0);
  });

  it("Edge Case A: Clicking empty space clears all selections", () => {
    const current = new Set(["heart", "lungs", "trachea"]);
    const updated = resolveOrganSelection(current, null, false);

    expect(updated.size).toBe(0);
  });

  it("Edge Case B: Attempting to isolate an empty selection does not activate isolation", () => {
    const empty = new Set<string>();
    const isolated = enterIsolationMode(empty);

    expect(isolated).toBeNull();
  });

  it("Edge Case C: Removing the last remaining organ from isolation restores the full body", () => {
    const isolated = new Set(["left_kidney"]);
    const afterDrop = removeOrganFromIsolation(isolated, "left_kidney");

    expect(afterDrop).toBeNull();
  });
});

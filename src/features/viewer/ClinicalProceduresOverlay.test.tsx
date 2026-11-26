import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CLINICAL_PROCEDURES_CATALOG } from "@/features/anatomy/clinicalProceduresCatalog";

describe("ClinicalProceduresOverlay targets", () => {
  it("verifies relative target position coordinates for all 5 procedures", () => {
    const baseAnchor = new THREE.Vector3(0.0, 1.28, 0.0);

    for (const proc of CLINICAL_PROCEDURES_CATALOG) {
      const worldPos = new THREE.Vector3(
        baseAnchor.x + proc.relativeTargetPosition[0],
        proc.relativeTargetPosition[1],
        baseAnchor.z + proc.relativeTargetPosition[2]
      );
      expect(Number.isFinite(worldPos.x)).toBe(true);
      expect(Number.isFinite(worldPos.y)).toBe(true);
      expect(Number.isFinite(worldPos.z)).toBe(true);
      expect(proc.ringRadius).toBeGreaterThan(0.005);
    }
  });

  it("ensures Lumbar Puncture is positioned posteriorly (negative Z)", () => {
    const lp = CLINICAL_PROCEDURES_CATALOG.find((p) => p.id === "lumbar_puncture")!;
    expect(lp.relativeTargetPosition[2]).toBeLessThan(0);
    // And lumbar height is below thoracic height
    expect(lp.relativeTargetPosition[1]).toBeLessThan(1.2);
  });

  it("ensures Chest Tube is positioned laterally at 5th intercostal level", () => {
    const chestTube = CLINICAL_PROCEDURES_CATALOG.find((p) => p.id === "chest_tube_thoracostomy")!;
    expect(chestTube.relativeTargetPosition[0]).toBeGreaterThan(0.08); // Lateral
    expect(chestTube.relativeTargetPosition[1]).toBeCloseTo(1.25, 1);
  });
});

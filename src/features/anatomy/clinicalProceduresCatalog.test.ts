import { describe, expect, it } from "vitest";
import {
  CLINICAL_PROCEDURES_CATALOG,
  getClinicalProcedure,
} from "./clinicalProceduresCatalog";

describe("clinicalProceduresCatalog", () => {
  it("contains 5 core emergency and clinical procedures from Harrison & Cecil", () => {
    expect(CLINICAL_PROCEDURES_CATALOG.length).toBe(5);
    const ids = CLINICAL_PROCEDURES_CATALOG.map((p) => p.id);
    expect(ids).toContain("lumbar_puncture");
    expect(ids).toContain("chest_tube_thoracostomy");
    expect(ids).toContain("internal_jugular_cvc");
    expect(ids).toContain("emergency_cricothyroidotomy");
    expect(ids).toContain("cardiac_auscultation_areas");
  });

  it("retrieves Lumbar Puncture with Tuffier line and correct depth layers", () => {
    const lp = getClinicalProcedure("lumbar_puncture");
    expect(lp).toBeDefined();
    expect(lp?.anatomicalLandmarkFa).toContain("خط توفیه");
    expect(lp?.needleTrajectoryEn).toContain("L3-L4");
    expect(lp?.tissueLayers.some((l) => l.en.includes("Ligamentum flavum"))).toBe(true);
    expect(lp?.dangerStructureFa).toContain("Conus Medullaris");
  });

  it("retrieves Chest Tube Thoracostomy with Safe Triangle boundaries and costal groove avoidance", () => {
    const chestTube = getClinicalProcedure("chest_tube_thoracostomy");
    expect(chestTube).toBeDefined();
    expect(chestTube?.nameEn).toContain("Tube Thoracostomy");
    expect(chestTube?.dangerStructureFa).toContain("VAN");
    expect(chestTube?.tissueLayers.some((l) => l.fa.includes("عضله دندانه‌ای قدامی"))).toBe(true);
  });

  it("retrieves Cricothyroidotomy with CICO indications", () => {
    const crico = getClinicalProcedure("emergency_cricothyroidotomy");
    expect(crico).toBeDefined();
    expect(crico?.clinicalIndicationFa).toContain("CICO");
    expect(crico?.dangerStructureEn).toContain("True vocal cords");
  });
});

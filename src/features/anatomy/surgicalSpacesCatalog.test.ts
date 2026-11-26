import { describe, expect, it } from "vitest";
import {
  SURGICAL_SPACES_CATALOG,
  getSurgicalSpace,
  resolveSurgicalSpaceOrgans,
} from "./surgicalSpacesCatalog";

describe("surgicalSpacesCatalog", () => {
  it("contains 10 high-yield surgical spaces from Gray's Surgical Anatomy", () => {
    expect(SURGICAL_SPACES_CATALOG.length).toBe(10);
    const ids = SURGICAL_SPACES_CATALOG.map((s) => s.id);
    expect(ids).toContain("calots_triangle");
    expect(ids).toContain("femoral_triangle");
    expect(ids).toContain("hesselbachs_triangle");
    expect(ids).toContain("carotid_triangle");
    expect(ids).toContain("muscular_triangle");
    expect(ids).toContain("popliteal_fossa");
    expect(ids).toContain("anatomical_snuffbox");
    expect(ids).toContain("carpal_tunnel");
    expect(ids).toContain("cubital_fossa");
    expect(ids).toContain("foramen_of_winslow");
  });

  it("retrieves Calot's triangle with Critical View of Safety clinical pearls", () => {
    const calot = getSurgicalSpace("calots_triangle");
    expect(calot).toBeDefined();
    expect(calot?.nameFa).toContain("مثلث کالوت");
    expect(calot?.clinicalSignificance.fa).toContain("Critical View of Safety");
    expect(calot?.contents.fa.some((c) => c.includes("شریان سیستیک"))).toBe(true);
  });

  it("retrieves Femoral triangle with NAVEL contents", () => {
    const femoral = getSurgicalSpace("femoral_triangle");
    expect(femoral).toBeDefined();
    expect(femoral?.nameEn).toContain("Femoral Triangle");
    expect(femoral?.contents.en.some((c) => c.includes("NAVEL"))).toBe(true);
    expect(femoral?.boundaries.superior?.en).toContain("Inguinal ligament");
  });

  it("resolves matching organ IDs for a surgical space against a list of organs", () => {
    const space = getSurgicalSpace("calots_triangle")!;
    const mockOrgans = [
      "gallbladder",
      "common_hepatic_artery",
      "proper_hepatic_artery",
      "femoral_artery_l",
      "biceps_brachii_l",
    ];
    const resolved = resolveSurgicalSpaceOrgans(space, mockOrgans);
    expect(resolved).toEqual(["gallbladder", "common_hepatic_artery", "proper_hepatic_artery"]);
  });
});

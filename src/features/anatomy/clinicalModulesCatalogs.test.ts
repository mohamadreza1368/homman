import { describe, expect, it } from "vitest";
import { SPINAL_ROOTS_CATALOG } from "./dermatomeMyotomeCatalog";
import { CRANIAL_NERVES_CATALOG, getCranialNerveForOrgan } from "./cranialNervesCatalog";
import { CORONARY_TERRITORIES_CATALOG, getCoronaryTerritoryForOrgan } from "./coronaryTerritoriesCatalog";
import { FASCIAL_COMPARTMENTS_CATALOG } from "./fascialCompartmentsCatalog";
import { LYMPHATIC_DRAINAGE_CATALOG, getLymphaticDrainageForOrgan } from "./lymphaticDrainageCatalog";
import { ORTHOPEDIC_TESTS_CATALOG, getOrthopedicTestForOrgan } from "./orthopedicTestsCatalog";

describe("6 clinical textbook modules", () => {
  it("covers spinal dermatomes & myotomes (C5-S1)", () => {
    expect(SPINAL_ROOTS_CATALOG.length).toBeGreaterThanOrEqual(9);
    expect(SPINAL_ROOTS_CATALOG.some((r) => r.root === "L5" && r.clinicalPearlEn.includes("foot drop"))).toBe(true);
  });

  it("covers all 12 cranial nerves (CN I - CN XII) and resolves organ IDs", () => {
    expect(CRANIAL_NERVES_CATALOG.length).toBe(12);
    expect(getCranialNerveForOrgan("facial_nerve_vii_l")?.number).toBe("CN VII");
    expect(getCranialNerveForOrgan("hypoglossal_nerve_xii_r")?.number).toBe("CN XII");
  });

  it("maps coronary arteries to ECG infarction territories", () => {
    expect(CORONARY_TERRITORIES_CATALOG.length).toBe(3);
    const lad = getCoronaryTerritoryForOrgan("left_coronary_artery");
    expect(lad?.ecgLeads).toEqual(["V1", "V2", "V3", "V4"]);
    const rca = getCoronaryTerritoryForOrgan("right_coronary_artery");
    expect(rca?.ecgLeads).toContain("aVF");
  });

  it("covers fascial compartments, lymphatic sentinel nodes, and orthopedic special tests", () => {
    expect(FASCIAL_COMPARTMENTS_CATALOG.length).toBe(4);
    expect(LYMPHATIC_DRAINAGE_CATALOG.length).toBe(4);
    expect(getLymphaticDrainageForOrgan("stomach")?.sentinelNodesEn).toContain("Virchow");

    expect(ORTHOPEDIC_TESTS_CATALOG.length).toBe(5);
    expect(getOrthopedicTestForOrgan("anterior_cruciate_ligament_l")?.testNameEn).toContain("Lachman");
  });
});

import { describe, expect, it } from "vitest";
import male from "../../../public/anatomy/manifest.json";
import female from "../../../public/anatomy/manifest_female.json";
import { diseases, diseasesForStructure, searchDiseases } from "./catalog";
import mondo from "../../../public/diseases/mondo-index.json";

describe("disease catalogue", () => {
  it("only links to structures present in the corresponding atlas", () => {
    const ids = { male: new Set(male.organs.map((organ) => organ.organ_id)), female: new Set(female.organs.map((organ) => organ.organ_id)) };
    for (const disease of diseases) for (const site of disease.sites) {
      for (const model of ["male", "female"] as const) for (const id of site[model]) expect(ids[model].has(id), `${disease.id}: ${model}/${id}`).toBe(true);
    }
  });

  it("finds Persian and English terms and maps selection only to exact sites", () => {
    expect(searchDiseases("كليه").map((d) => d.id)).toContain("kidney-stones");
    expect(searchDiseases("liver").map((d) => d.id)).toContain("cirrhosis");
    expect(diseasesForStructure("kidney_l", "male").map((d) => d.id)).toContain("kidney-stones");
    expect(diseasesForStructure("kidney_l", "female")).toEqual([]);
  });

  it("ships the versioned Mondo index with unique identifiers", () => {
    expect(mondo.release).toContain("mondo/releases/");
    expect(mondo.entries.length).toBeGreaterThan(10000);
    expect(new Set(mondo.entries.map((entry) => entry[0])).size).toBe(mondo.entries.length);
    expect(mondo.entries.some((entry) => entry[1]?.toLowerCase() === "asthma")).toBe(true);
  });
});

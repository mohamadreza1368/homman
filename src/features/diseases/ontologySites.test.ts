import { expect, it } from "vitest";
import male from "../../../public/anatomy/manifest.json";
import female from "../../../public/anatomy/manifest_female.json";
import data from "../../../public/diseases/do-sites.json";

it("keeps ontology provenance and points only at available model structures", () => {
  const ids = { male: new Set(male.organs.map((o) => o.organ_id)), female: new Set(female.organs.map((o) => o.organ_id)) };
  expect(data.diseases.length).toBeGreaterThan(100);
  for (const disease of data.diseases) for (const site of disease.sites) {
    expect(site.uberon).toMatch(/^UBERON:\d+$/);
    expect(site.sourceDisease).toMatch(/^DOID:\d+$/);
    for (const model of ["male", "female"] as const) for (const id of site[model]) expect(ids[model].has(id)).toBe(true);
  }
  expect(data.diseases.some((d) => d.sites.some((s) => s.sourceDisease !== d.id))).toBe(true);
});

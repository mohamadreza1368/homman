import { expect, it } from "vitest";
import male from "../../../public/anatomy/manifest.json";
import female from "../../../public/anatomy/manifest_female.json";
import { anatomyConcepts, conceptForStructure } from "./concepts";

it("maps concepts only to real structures and does not infer missing equivalents", () => {
  const ids = { male: new Set(male.organs.map((o) => o.organ_id)), female: new Set(female.organs.map((o) => o.organ_id)) };
  expect(new Set(anatomyConcepts.map((concept) => concept.id)).size).toBe(anatomyConcepts.length);
  for (const concept of anatomyConcepts) for (const model of ["male", "female"] as const) for (const id of concept.models[model]) expect(ids[model].has(id)).toBe(true);
  expect(conceptForStructure("female", "gallbladder")?.id).toBe("homman:gallbladder");
  expect(conceptForStructure("female", "kidney_l")).toBeUndefined();
});

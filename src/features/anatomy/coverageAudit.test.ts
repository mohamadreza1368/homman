import { expect, it } from "vitest";
import male from "../../../public/anatomy/manifest.json";
import female from "../../../public/anatomy/manifest_female.json";
import report from "../../../public/anatomy/coverage-report.json";

it("covers each source structure once and treats exact names as candidates", () => {
  const maleIds = report.rows.flatMap((row) => row.male ? [row.male] : []);
  const femaleIds = report.rows.flatMap((row) => row.female ? [row.female] : []);
  expect(new Set(maleIds).size).toBe(male.organs.length);
  expect(maleIds.length).toBe(male.organs.length);
  expect(new Set(femaleIds).size).toBe(female.organs.length);
  expect(femaleIds.length).toBe(female.organs.length);
  const maleMap = new Map(male.organs.map((o) => [o.organ_id, o]));
  const femaleMap = new Map(female.organs.map((o) => [o.organ_id, o]));
  for (const row of report.rows.filter((r) => r.status === "candidate")) {
    expect(maleMap.get(row.male!)?.system).toBe(femaleMap.get(row.female!)?.system);
    expect(maleMap.get(row.male!)?.name_en.trim().toLowerCase()).toBe(femaleMap.get(row.female!)?.name_en.trim().toLowerCase());
  }
});

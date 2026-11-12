import { readFile, writeFile } from "node:fs/promises";

// Exact names are candidates for human review, never anatomical equivalence.
const male = JSON.parse(await readFile("public/anatomy/manifest.json", "utf8"));
const female = JSON.parse(await readFile("public/anatomy/manifest_female.json", "utf8"));
const key = (organ) => `${organ.system}\u0000${organ.name_en.trim().toLowerCase().replace(/\s+/g, " ")}`;
const groups = (organs) => {
  const result = new Map();
  for (const organ of organs) {
    const list = result.get(key(organ)) ?? [];
    list.push(organ);
    result.set(key(organ), list);
  }
  return result;
};
const maleGroups = groups(male.organs);
const femaleGroups = groups(female.organs);
const rows = [];
for (const organ of male.organs) {
  const k = key(organ);
  const candidates = femaleGroups.get(k) ?? [];
  rows.push({ male: organ.organ_id, female: candidates.length === 1 && maleGroups.get(k).length === 1 ? candidates[0].organ_id : null,
    name: organ.name_en, system: organ.system, status: candidates.length === 1 && maleGroups.get(k).length === 1 ? "candidate" : candidates.length ? "ambiguous" : "unmatched" });
}
const matchedFemale = new Set(rows.flatMap((r) => r.female ? [r.female] : []));
for (const organ of female.organs) if (!matchedFemale.has(organ.organ_id)) {
  const candidates = maleGroups.get(key(organ)) ?? [];
  rows.push({ male: null, female: organ.organ_id, name: organ.name_en, system: organ.system, status: candidates.length ? "ambiguous" : "unmatched" });
}
const result = { maleCount: male.organs.length, femaleCount: female.organs.length, method: "unique exact English label and system; unreviewed candidate only", rows };
await writeFile("public/anatomy/coverage-report.json", JSON.stringify(result));
console.log(`Audited ${male.organs.length} male and ${female.organs.length} female structures; ${rows.filter((r) => r.status === "candidate").length} unreviewed candidates`);

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AnatomyManifest } from "@/lib/schemas";
import { buildFhirBodyStructure, resolveOrganOntology } from "./ontologyCatalog";
import { enrichManifestWithSupplementaryOrgans } from "./supplementaryOrgans";

describe("ontologyCatalog", () => {
  it("resolves exact TA2/UBERON/FMA/SNOMED mappings for core organs", () => {
    const liver = resolveOrganOntology({
      organ_id: "liver",
      ta2_latin: "Hepar",
      system: "digestive",
    });
    expect(liver.precision).toBe("exact");
    expect(liver.uberon).toBe("UBERON:0002107");
    expect(liver.fma).toBe("FMA:7197");
    expect(liver.snomed).toBe("10200004");
  });

  it("achieves 100% ontology coverage across all organs in the male manifest + supplementary organs", () => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "public", "anatomy", "manifest.json"), "utf8"),
    ) as AnatomyManifest;
    const enriched = enrichManifestWithSupplementaryOrgans(raw);

    expect(enriched.organs.length).toBeGreaterThanOrEqual(3483);

    for (const organ of enriched.organs) {
      const ont = resolveOrganOntology(organ);
      expect(ont.uberon).toMatch(/^UBERON:\d+/);
      expect(ont.fma).toMatch(/^FMA:\d+/);
    }
  });

  it("builds valid HL7 FHIR BodyStructure payloads with laterality", () => {
    const fhir = buildFhirBodyStructure(
      {
        organ_id: "kidney_l",
        name_en: "Left kidney",
        ta2_latin: "Ren sinister",
        system: "renal",
      },
      "male",
    );
    expect(fhir.resourceType).toBe("BodyStructure");
    expect(fhir.id).toBe("hoomaan-male-kidney_l");
    expect(fhir.locationQualifier?.[0]?.coding[0]?.display).toBe("Left");
  });
});

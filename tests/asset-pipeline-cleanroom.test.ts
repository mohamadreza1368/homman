import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AnatomyManifestSchema } from "../src/lib/schemas";
import { HoomaanPlatformBootstrap } from "../src/main";
import { AnatomicalTerminologyService } from "../tools/asset-pipeline/ta2.mjs";
import { TaxonomyCurationEngine } from "../tools/asset-pipeline/hierarchy.mjs";
import { MaleAtlasManifestGenerator } from "../tools/asset-pipeline/build-manifest.mjs";
import {
  FemaleAtlasRegistry,
  STRUCTURES,
} from "../tools/asset-pipeline/hra-selection.mjs";
import { FemaleGeometryExtractor } from "../tools/asset-pipeline/extract-hra.mjs";

const REPO_ROOT = join(__dirname, "..");

describe("Specification-Driven Clean-Room Test Suite", () => {
  describe("Application Bootstrap (specs/application-bootstrap.md)", () => {
    it("configures Persian language and RTL layout on document root", () => {
      HoomaanPlatformBootstrap.initialize();
      expect(document.documentElement.getAttribute("lang")).toBe("fa");
      expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    });

    it("ensures mounting element exists in DOM", () => {
      const container = document.getElementById(HoomaanPlatformBootstrap.ROOT_ELEMENT_ID);
      expect(container).toBeDefined();
    });
  });

  describe("Terminologia Anatomica 2 (specs/asset-pipeline-terminologia-anatomica.md)", () => {
    it("strips Latin diacritical accents to normalized NFC text", () => {
      expect(AnatomicalTerminologyService.cleanAccents("Musculus psoās mājor")).toBe(
        "Musculus psoas major",
      );
      expect(AnatomicalTerminologyService.cleanAccents("Cérebrum")).toBe("Cerebrum");
      expect(AnatomicalTerminologyService.cleanAccents("")).toBe("");
    });

    it("generates deterministic URL-safe alphanumeric slugs", () => {
      expect(
        AnatomicalTerminologyService.createSlug("Articular capsule of knee joint (left) #1"),
      ).toBe("articular_capsule_of_knee_joint_left_1");
      expect(AnatomicalTerminologyService.createSlug("__Heart ventricles__")).toBe(
        "heart_ventricles",
      );
      expect(AnatomicalTerminologyService.createSlug("Hepar")).toBe("hepar");
    });

    it("throws clear error on empty CSV or missing required columns", () => {
      const service = new AnatomicalTerminologyService();
      expect(() => service.parseCsvRecords("")).toThrow(/Empty TA2 CSV dataset/);
      expect(() => service.parseCsvRecords("ColA;ColB\n1;2")).toThrow(/missing required headers/);
    });

    it("parses valid CSV records and applies normalized dictionary lookups", () => {
      const sampleCsv = [
        "Entity;Latin;English",
        "A01.1.00.001;Caput;Head",
        "A12.2.12.015;Truncus coeliacus;Celiac trunk",
      ].join("\n");

      const service = new AnatomicalTerminologyService({}, {});
      const dict = service.parseCsvRecords(sampleCsv);

      expect(dict.get("head")).toEqual({ en: "Head", la: "Caput" });
      expect(dict.get("celiac trunk")).toEqual({ en: "Celiac trunk", la: "Truncus coeliacus" });
    });

    it("fails early when a correction is specified for a non-existent vocabulary key", () => {
      const sampleCsv = ["Entity;Latin;English", "A01.1.00.001;Caput;Head"].join("\n");

      const service = new AnatomicalTerminologyService({
        "phantom organ": { en: "Phantom", la: "Phantoma" },
      }, {});

      expect(() => service.parseCsvRecords(sampleCsv)).toThrow(
        /Correction specified for non-existent vocabulary key/,
      );
    });
  });

  describe("Anatomical Hierarchy Curation (specs/asset-pipeline-anatomical-hierarchy.md)", () => {
    it("fails early when a curated path rule matches no structures", () => {
      const engine = new TaxonomyCurationEngine(
        { "Ghost Structure": ["Central nervous system", "Brain"] },
        {},
      );

      expect(() =>
        engine.curateOrganTaxonomy([
          {
            organ_id: "valid_organ",
            ta2_latin: "Corpus callosum",
            system: "nervous",
            path: [],
          },
        ]),
      ).toThrow(/NERVOUS_PATHS has entries matching no structure/);
    });

    it("fails early when a heading replacement matches no heading", () => {
      const engine = new TaxonomyCurationEngine(
        {},
        { "NonExistentHeading": "Replacement" },
      );

      expect(() =>
        engine.curateOrganTaxonomy([
          {
            organ_id: "org1",
            ta2_latin: "Structure A",
            system: "skeletal",
            path: ["Skeletal system", "Bones"],
          },
        ]),
      ).toThrow(/HEADING_RENAMES has entries matching no heading/);
    });

    it("propagates maximal depth between twin structures", () => {
      const engine = new TaxonomyCurationEngine({}, {});
      const result = engine.curateOrganTaxonomy([
        {
          organ_id: "twin_l",
          ta2_latin: "Structure X",
          system: "nervous",
          path: ["PNS", "Branch"],
        },
        {
          organ_id: "twin_r",
          ta2_latin: "Structure X",
          system: "nervous",
          path: ["PNS", "Branch", "Deep Leaf"],
        },
      ]);

      expect(result.organs[0]!.path).toEqual(["PNS", "Branch", "Deep Leaf"]);
      expect(result.organs[1]!.path).toEqual(["PNS", "Branch", "Deep Leaf"]);
      expect(result.propagated).toBe(1);
    });

    it("renames taxonomic headings as configured", () => {
      const engine = new TaxonomyCurationEngine({}, { Muscles: "Other muscles" });
      const result = engine.curateOrganTaxonomy([
        {
          organ_id: "m_soleus",
          ta2_latin: "Soleus",
          system: "muscular",
          path: ["Muscles", "Leg"],
        },
      ]);

      expect(result.organs[0]!.path).toEqual(["Other muscles", "Leg"]);
      expect(result.renamed).toBe(1);
    });

    it("curates male anatomy manifest so Brain holds all subdivisions and both hemispheres", () => {
      const manifestPath = join(REPO_ROOT, "public/anatomy/manifest.json");
      const maleManifest = AnatomyManifestSchema.parse(
        JSON.parse(readFileSync(manifestPath, "utf8")),
      );

      const byId = (id: string) => maleManifest.organs.find((o) => o.organ_id === id);

      // Verify all major brain subdivisions reside within Brain
      const majorDivisions = [
        ["corpus_callosum", "Telencephalon"],
        ["thalamus_l", "Diencephalon"],
        ["hypothalamus", "Diencephalon"],
        ["midbrain_l", "Mesencephalon"],
        ["pons_l", "Pons"],
        ["medulla_oblongata_l", "Medulla oblongata"],
      ] as const;

      for (const [id, division] of majorDivisions) {
        const organ = byId(id);
        expect(organ, `Expected organ ${id} to exist`).toBeDefined();
        expect(organ!.path, `Expected ${id} to be in Brain`).toContain("Brain");
        expect(organ!.path, `Expected ${id} to be in ${division}`).toContain(division);
      }

      // Verify both left and right hemispheres of paired cortical structures are in Brain
      const pairedStructures = [
        "precentral_gyrus",
        "postcentral_gyrus",
        "superior_frontal_gyrus",
        "hippocampus",
      ];

      for (const base of pairedStructures) {
        const left = byId(`${base}_l`);
        const right = byId(`${base}_r`);
        expect(left, `Expected left ${base} to exist`).toBeDefined();
        expect(right, `Expected right ${base} to exist`).toBeDefined();
        expect(left!.path).toContain("Brain");
        expect(right!.path).toContain("Brain");
      }
    });
  });

  describe("Manifest Builder & Router (specs/asset-pipeline-manifest-builder.md)", () => {
    it("normalizes Blender node names and detects laterality", () => {
      const leftResult = MaleAtlasManifestGenerator.parseNodeIdentifier("Hepar.l");
      expect(leftResult.cleanName).toBe("Hepar");
      expect(leftResult.laterality).toBe("left");

      const rightResult = MaleAtlasManifestGenerator.parseNodeIdentifier("Femur.r");
      expect(rightResult.cleanName).toBe("Femur");
      expect(rightResult.laterality).toBe("right");

      const complexResult = MaleAtlasManifestGenerator.parseNodeIdentifier("(Biceps brachii.el)");
      expect(complexResult.cleanName).toBe("Biceps brachii");
      expect(complexResult.laterality).toBe("left");

      const neutralResult = MaleAtlasManifestGenerator.parseNodeIdentifier("Aorta");
      expect(neutralResult.cleanName).toBe("Aorta");
      expect(neutralResult.laterality).toBeNull();
    });

    it("routes visceral organs into specialized physiological systems", () => {
      expect(MaleAtlasManifestGenerator.classifyVisceralOrgan("Left lung")).toBe("respiratory");
      expect(MaleAtlasManifestGenerator.classifyVisceralOrgan("Gallbladder")).toBe("digestive");
      expect(MaleAtlasManifestGenerator.classifyVisceralOrgan("Right kidney")).toBe("renal");
      expect(MaleAtlasManifestGenerator.classifyVisceralOrgan("Thyroid gland")).toBe("endocrine");
      expect(MaleAtlasManifestGenerator.classifyVisceralOrgan("Prostate")).toBe("reproductive");
      expect(MaleAtlasManifestGenerator.classifyVisceralOrgan("Unknown structure")).toBeNull();
    });

    it("validates male anatomy manifest against AnatomyManifestSchema", () => {
      const raw = JSON.parse(readFileSync(join(REPO_ROOT, "public/anatomy/manifest.json"), "utf8"));
      const parsed = AnatomyManifestSchema.parse(raw);
      expect(parsed.version).toBe(1);
      expect(parsed.gender_model).toBe("male");
      expect(parsed.organs.length).toBeGreaterThan(3000);
      expect(parsed.systems.length).toBeGreaterThanOrEqual(10);
    });

    it("validates female anatomy manifest against AnatomyManifestSchema", () => {
      const raw = JSON.parse(
        readFileSync(join(REPO_ROOT, "public/anatomy/manifest_female.json"), "utf8"),
      );
      const parsed = AnatomyManifestSchema.parse(raw);
      expect(parsed.version).toBe(1);
      expect(parsed.gender_model).toBe("female");
      expect(parsed.organs.length).toBeGreaterThan(200);
      expect(parsed.systems.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("HRA Clinical Nomenclature & Registry (specs/asset-pipeline-hra-extraction.md)", () => {
    it("formats clinical display names with qualifiers and laterality", () => {
      expect(
        FemaleGeometryExtractor.formatClinicalName({
          term: "Ureter",
          qualifier: "pelvic part",
          side: "left",
        }),
      ).toBe("Ureter, pelvic part (left)");

      expect(
        FemaleGeometryExtractor.formatClinicalName({
          term: "Aorta",
          side: null,
        }),
      ).toBe("Aorta");

      expect(
        FemaleGeometryExtractor.formatClinicalName({
          term: "Ovary",
          side: "right",
        }),
      ).toBe("Ovary (right)");
    });

    it("resolves anatomical systems from taxonomy root categories", () => {
      expect(FemaleAtlasRegistry.resolveSystem("Uterus")).toBe("reproductive");
      expect(FemaleAtlasRegistry.resolveSystem("Kidney")).toBe("renal");
      expect(FemaleAtlasRegistry.resolveSystem("Liver")).toBe("digestive");
      expect(FemaleAtlasRegistry.resolveSystem("Pelvic vessels")).toBe("cardiovascular");
      expect(FemaleAtlasRegistry.resolveSystem("Pelvic girdle")).toBe("skeletal");
      expect(FemaleAtlasRegistry.resolveSystem("Breast")).toBe("integumentary");
      expect(FemaleAtlasRegistry.resolveSystem("Spleen")).toBe("lymphatic");
      expect(() => FemaleAtlasRegistry.resolveSystem("Unknown Root")).toThrow(/Unmapped anatomical system/);
    });

    it("ensures all female structures in registry have unique identifiers", () => {
      const ids = STRUCTURES.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("ensures paired female structures sharing a term and side have unique qualifiers", () => {
      const seen = new Map<string, string>();
      for (const entry of STRUCTURES) {
        const key = `${entry.term}::${entry.side || "none"}::${entry.qualifier || "none"}`;
        expect(
          seen.has(key),
          `Duplicate qualifier key found: ${key} for node ${entry.node}`,
        ).toBe(false);
        seen.set(key, entry.node);
      }
    });

    it("calculates polygon count from mock glTF primitives", () => {
      const mockMesh = {
        listPrimitives: () => [
          {
            getIndices: () => ({ getCount: () => 300 }),
            getAttribute: () => null,
          },
          {
            getIndices: () => null,
            getAttribute: (attr: string) => (attr === "POSITION" ? { getCount: () => 150 } : null),
          },
        ],
      };

      const count = FemaleGeometryExtractor.countMeshTriangles(mockMesh);
      // 300 / 3 = 100, 150 / 3 = 50 -> 150
      expect(count).toBe(150);
    });
  });
});

import { describe, expect, it } from "vitest";

import { HoomaanPlatformBootstrap } from "../src/main";
import {
  TerminologiaAnatomicaIndexer,
  parseTa2,
  slugify,
} from "../tools/asset-pipeline/ta2.mjs";
import {
  AnatomyHierarchyRepairPipeline,
  repairHierarchy,
} from "../tools/asset-pipeline/hierarchy.mjs";
import { MaleAnatomyManifestCompiler } from "../tools/asset-pipeline/build-manifest.mjs";
import { HraModelExtractor } from "../tools/asset-pipeline/extract-hra.mjs";

describe("Specification-driven Asset Pipeline & Runtime Suite", () => {
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
      expect(TerminologiaAnatomicaIndexer.stripDiacritics("Musculus psoās mājor")).toBe(
        "Musculus psoas major",
      );
      expect(TerminologiaAnatomicaIndexer.stripDiacritics("Cérebrum")).toBe("Cerebrum");
    });

    it("generates deterministic URL-safe alphanumeric slugs", () => {
      expect(slugify("Articular capsule of knee joint (left) #1")).toBe(
        "articular_capsule_of_knee_joint_left_1",
      );
      expect(slugify("__Heart ventricles__")).toBe("heart_ventricles");
    });

    it("throws clear error on empty CSV or missing required columns", () => {
      expect(() => parseTa2("")).toThrow(/Empty TA2 CSV dataset/);
      expect(() => parseTa2("ColA;ColB\n1;2")).toThrow(/missing required headers/);
    });
  });

  describe("Anatomical Hierarchy Curation (specs/asset-pipeline-anatomical-hierarchy.md)", () => {
    it("fails early when a curated path rule matches no structures", () => {
      const pipeline = new AnatomyHierarchyRepairPipeline(
        { "Ghost Structure": ["Central nervous system", "Brain"] },
        {},
      );

      expect(() =>
        pipeline.process([
          {
            organ_id: "valid_organ",
            ta2_latin: "Corpus callosum",
            system: "nervous",
            path: [],
          },
        ]),
      ).toThrow(/matching no structure/);
    });

    it("propagates maximal depth between twin structures", () => {
      const pipeline = new AnatomyHierarchyRepairPipeline({}, {});
      const result = pipeline.process([
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
      const pipeline = new AnatomyHierarchyRepairPipeline({}, { Muscles: "Other muscles" });
      const result = pipeline.process([
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

    it("convenience repairHierarchy function guards against empty dataset", () => {
      expect(() => repairHierarchy([])).toThrow(/matching no structure/);
    });
  });

  describe("Manifest Builder & Router (specs/asset-pipeline-manifest-builder.md)", () => {
    it("normalizes Blender node names and detects laterality", () => {
      const leftResult = MaleAnatomyManifestCompiler.normalizeBlenderIdentifier("Hepar.l");
      expect(leftResult.cleanName).toBe("Hepar");
      expect(leftResult.laterality).toBe("left");

      const rightResult = MaleAnatomyManifestCompiler.normalizeBlenderIdentifier("Femur.r");
      expect(rightResult.cleanName).toBe("Femur");
      expect(rightResult.laterality).toBe("right");

      const complexResult = MaleAnatomyManifestCompiler.normalizeBlenderIdentifier("(Biceps brachii.el)");
      expect(complexResult.cleanName).toBe("Biceps brachii");
      expect(complexResult.laterality).toBe("left");
    });

    it("routes visceral organs into specialized physiological systems", () => {
      expect(MaleAnatomyManifestCompiler.categorizeVisceralOrgan("Left lung")).toBe("respiratory");
      expect(MaleAnatomyManifestCompiler.categorizeVisceralOrgan("Gallbladder")).toBe("digestive");
      expect(MaleAnatomyManifestCompiler.categorizeVisceralOrgan("Right kidney")).toBe("renal");
      expect(MaleAnatomyManifestCompiler.categorizeVisceralOrgan("Thyroid gland")).toBe("endocrine");
      expect(MaleAnatomyManifestCompiler.categorizeVisceralOrgan("Prostate")).toBe("reproductive");
      expect(MaleAnatomyManifestCompiler.categorizeVisceralOrgan("Unknown structure")).toBeNull();
    });
  });

  describe("HRA Clinical Nomenclature (specs/asset-pipeline-hra-extraction.md)", () => {
    it("formats clinical display names with qualifiers and laterality", () => {
      expect(
        HraModelExtractor.formatClinicalName({
          term: "Ureter",
          qualifier: "pelvic part",
          side: "left",
        }),
      ).toBe("Ureter, pelvic part (left)");

      expect(
        HraModelExtractor.formatClinicalName({
          term: "Aorta",
          side: null,
        }),
      ).toBe("Aorta");
    });
  });
});

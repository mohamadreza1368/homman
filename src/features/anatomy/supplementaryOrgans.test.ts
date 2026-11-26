import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  SUPPLEMENTARY_MANIFEST_ORGANS,
  buildSupplementaryOrganGeometry,
  enrichManifestWithSupplementaryOrgans,
  isSupplementaryOrganId,
} from "./supplementaryOrgans";

describe("supplementaryOrgans", () => {
  it("enriches male manifest with 5 missing TA2 structures without duplicating existing ones", () => {
    const base = {
      version: 1,
      gender_model: "male" as const,
      attribution: "Z-Anatomy",
      license: "CC-BY-SA-4.0",
      systems: [],
      organs: [
        {
          organ_id: "liver",
          ta2_latin: "Hepar",
          name_en: "Liver",
          system: "digestive" as const,
          mesh_file: "digestive_male.glb",
          node: "Liver",
          path: ["Alimentary system"],
        },
      ],
    };

    const enriched = enrichManifestWithSupplementaryOrgans(base);
    expect(enriched.organs.length).toBe(1 + SUPPLEMENTARY_MANIFEST_ORGANS.length);
    expect(isSupplementaryOrganId("caecum")).toBe(true);
    expect(isSupplementaryOrganId("thoracic_duct")).toBe(true);
    expect(isSupplementaryOrganId("vocal_folds")).toBe(true);
    // Real GLB-backed organs from bp3d_missing_male.glb do not need procedural fallback
    expect(isSupplementaryOrganId("ileum")).toBe(false);
    expect(isSupplementaryOrganId("rectum")).toBe(false);
  });

  it("builds valid BufferGeometry with normals and UVs for procedural fallback organs", () => {
    const boxes = new Map<string, THREE.Box3>();
    const centres = new Map<string, THREE.Vector3>();

    for (const spec of SUPPLEMENTARY_MANIFEST_ORGANS.filter((s) => isSupplementaryOrganId(s.organ_id))) {
      const geom = buildSupplementaryOrganGeometry(spec.organ_id, boxes, centres);
      expect(geom).not.toBeNull();
      expect(geom!.getAttribute("position").count).toBeGreaterThan(20);
      expect(geom!.getAttribute("normal").count).toBeGreaterThan(20);
      geom!.computeBoundingBox();
      expect(geom!.boundingBox!.isEmpty()).toBe(false);
      geom!.dispose();
    }
  });
});

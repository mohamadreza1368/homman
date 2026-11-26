import { describe, expect, it } from "vitest";
import type { ManifestOrgan } from "@/lib/schemas";
import {
  getPedicleDefinition,
  resolvePedicleMembers,
  SURGICAL_PEDICLES,
} from "./pedicleCatalog";

describe("pedicleCatalog", () => {
  const mockOrgans: Record<string, ManifestOrgan> = {
    kidney_l: {
      organ_id: "kidney_l",
      ta2_latin: "Ren sinister",
      name_en: "Left kidney",
      system: "renal",
      path: ["Urinary system"],
      mesh_file: "f.glb",
      node: "n1",
    },
    left_renal_artery: {
      organ_id: "left_renal_artery",
      ta2_latin: "Arteria renalis sinistra",
      name_en: "Left renal artery",
      system: "cardiovascular",
      path: ["Systemic arteries"],
      mesh_file: "f.glb",
      node: "n2",
    },
    left_renal_vein: {
      organ_id: "left_renal_vein",
      ta2_latin: "Vena renalis sinistra",
      name_en: "Left renal vein",
      system: "cardiovascular",
      path: ["Systemic veins"],
      mesh_file: "f.glb",
      node: "n3",
    },
    right_renal_artery: {
      organ_id: "right_renal_artery",
      ta2_latin: "Arteria renalis dextra",
      name_en: "Right renal artery",
      system: "cardiovascular",
      path: ["Systemic arteries"],
      mesh_file: "f.glb",
      node: "n4",
    },
    liver: {
      organ_id: "liver",
      ta2_latin: "Hepar",
      name_en: "Liver",
      system: "digestive",
      path: ["Digestive system"],
      mesh_file: "f.glb",
      node: "n5",
    },
    proper_hepatic_artery: {
      organ_id: "proper_hepatic_artery",
      ta2_latin: "Arteria hepatica propria",
      name_en: "Proper hepatic artery",
      system: "cardiovascular",
      path: ["Systemic arteries"],
      mesh_file: "f.glb",
      node: "n6",
    },
    hepatic_portal_vein: {
      organ_id: "hepatic_portal_vein",
      ta2_latin: "Vena portae hepatis",
      name_en: "Hepatic portal vein",
      system: "cardiovascular",
      path: ["Systemic veins"],
      mesh_file: "f.glb",
      node: "n7",
    },
  };

  it("identifies organs with known surgical pedicles", () => {
    expect(getPedicleDefinition("kidney_l")).toBeDefined();
    expect(getPedicleDefinition("kidney_r")).toBeDefined();
    expect(getPedicleDefinition("liver")).toBeDefined();
    expect(getPedicleDefinition("stomach")).toBeDefined();
    expect(getPedicleDefinition("spleen")).toBeDefined();
    expect(getPedicleDefinition("unknown_bone")).toBeUndefined();
  });

  it("resolves renal pedicle including renal artery and vein with side specificity", () => {
    const pedicle = resolvePedicleMembers("kidney_l", mockOrgans);
    expect(pedicle).toContain("kidney_l");
    expect(pedicle).toContain("left_renal_artery");
    expect(pedicle).toContain("left_renal_vein");
    expect(pedicle).not.toContain("right_renal_artery");
  });

  it("resolves hepatic triad and vascular pedicle for liver", () => {
    const pedicle = resolvePedicleMembers("liver", mockOrgans);
    expect(pedicle).toContain("liver");
    expect(pedicle).toContain("proper_hepatic_artery");
    expect(pedicle).toContain("hepatic_portal_vein");
  });

  it("falls back to single organ when no pedicle definition matches", () => {
    const result = resolvePedicleMembers("femur_l", mockOrgans);
    expect(result).toEqual(["femur_l"]);
  });

  it("has valid bilingual labels for all registered surgical pedicles", () => {
    for (const def of SURGICAL_PEDICLES) {
      expect(def.labelEn.length).toBeGreaterThan(0);
      expect(def.labelFa.length).toBeGreaterThan(0);
    }
  });
});

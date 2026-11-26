import { describe, expect, it } from "vitest";
import type { ManifestOrgan } from "@/lib/schemas";
import {
  isOrganVisible,
  organDepthTier,
  organLaterality,
} from "@/stores/sceneUtils";
import { useSceneStore } from "@/stores/sceneStore";

describe("dissectionEngine", () => {
  const platysmaL: ManifestOrgan = {
    organ_id: "platysma_l",
    ta2_latin: "Platysma",
    name_en: "Platysma (left)",
    system: "muscular",
    path: ["Cervical part of muscular system", "Superficial muscles"],
    mesh_file: "f.glb",
    node: "platysma.l",
  };

  const platysmaR: ManifestOrgan = {
    organ_id: "platysma_r",
    ta2_latin: "Platysma",
    name_en: "Platysma (right)",
    system: "muscular",
    path: ["Cervical part of muscular system", "Superficial muscles"],
    mesh_file: "f.glb",
    node: "platysma.r",
  };

  const deepMuscleL: ManifestOrgan = {
    organ_id: "scalenus_anterior_l",
    ta2_latin: "Musculus scalenus anterior",
    name_en: "Scalenus anterior (left)",
    system: "muscular",
    path: ["Cervical part of muscular system", "Deep muscles"],
    mesh_file: "f.glb",
    node: "scalenus.l",
  };

  const boneMidline: ManifestOrgan = {
    organ_id: "cervical_vertebra_c3",
    ta2_latin: "Vertebra cervicalis III",
    name_en: "Third cervical vertebra",
    system: "skeletal",
    path: ["Vertebral column"],
    mesh_file: "f.glb",
    node: "c3",
  };

  it("classifies organ laterality accurately", () => {
    expect(organLaterality(platysmaL)).toBe("left");
    expect(organLaterality(platysmaR)).toBe("right");
    expect(organLaterality(boneMidline)).toBe("midline");
  });

  it("determines anatomical depth tiers correctly", () => {
    expect(organDepthTier(platysmaL)).toBe(1); // Superficial muscle
    expect(organDepthTier(deepMuscleL)).toBe(2); // Intermediate muscle
    expect(organDepthTier(boneMidline)).toBe(3); // Skeletal deep framework
  });

  it("applies Netter half-dissection (right deep, left superficial)", () => {
    const baseState = {
      hiddenSystems: [],
      hiddenOrganIds: [],
      isolatedOrganIds: null,
      hideConnective: false,
      connectiveIds: new Set<string>(),
      halfDissection: "right" as const,
      dissectionDepth: 0,
    };

    // Left superficial muscle remains visible
    expect(isOrganVisible(baseState, platysmaL)).toBe(true);

    // Right superficial and intermediate muscles are peeled away
    expect(isOrganVisible(baseState, platysmaR)).toBe(false);

    // Deep skeletal structure remains visible on both sides
    expect(isOrganVisible(baseState, boneMidline)).toBe(true);
  });

  it("applies progressive depth peeling across all structures", () => {
    const depth1State = {
      hiddenSystems: [],
      hiddenOrganIds: [],
      isolatedOrganIds: null,
      hideConnective: false,
      connectiveIds: new Set<string>(),
      halfDissection: "off" as const,
      dissectionDepth: 1, // Superficial fascia & muscles peeled
    };

    expect(isOrganVisible(depth1State, platysmaL)).toBe(false); // Superficial is hidden
    expect(isOrganVisible(depth1State, deepMuscleL)).toBe(true); // Deep muscle is still visible
    expect(isOrganVisible(depth1State, boneMidline)).toBe(true); // Bone is visible

    const depth2State = { ...depth1State, dissectionDepth: 2 }; // Intermediate peeled
    expect(isOrganVisible(depth2State, deepMuscleL)).toBe(false);
    expect(isOrganVisible(depth2State, boneMidline)).toBe(true);
  });

  it("updates halfDissection and dissectionDepth via scene store actions", () => {
    const store = useSceneStore.getState();

    store.setHalfDissection("right");
    expect(useSceneStore.getState().halfDissection).toBe("right");

    store.cycleHalfDissection();
    expect(useSceneStore.getState().halfDissection).toBe("left");

    store.cycleHalfDissection();
    expect(useSceneStore.getState().halfDissection).toBe("off");

    store.setDissectionDepth(2);
    expect(useSceneStore.getState().dissectionDepth).toBe(2);

    store.cycleDissectionDepth();
    expect(useSceneStore.getState().dissectionDepth).toBe(3);

    store.cycleDissectionDepth();
    expect(useSceneStore.getState().dissectionDepth).toBe(0);
  });
});

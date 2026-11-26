import { describe, expect, it } from "vitest";
import type { ManifestOrgan } from "@/lib/schemas";
import { buildHierarchyTree } from "./treeHierarchyBuilder";

describe("treeHierarchyBuilder", () => {
  const organs: ManifestOrgan[] = [
    {
      organ_id: "biceps_l",
      ta2_latin: "Biceps brachii",
      name_en: "Biceps (left)",
      system: "muscular",
      path: ["Upper limb", "Arm", "Anterior compartment"],
      mesh_file: "f.glb",
      node: "biceps.l",
    },
    {
      organ_id: "coracobrachialis_l",
      ta2_latin: "Coracobrachialis",
      name_en: "Coracobrachialis (left)",
      system: "muscular",
      path: ["Upper limb", "Arm", "Anterior compartment"],
      mesh_file: "f.glb",
      node: "coraco.l",
    },
    {
      organ_id: "triceps_l",
      ta2_latin: "Triceps brachii",
      name_en: "Triceps (left)",
      system: "muscular",
      path: ["Upper limb", "Arm", "Posterior compartment"],
      mesh_file: "f.glb",
      node: "triceps.l",
    },
    {
      organ_id: "deltoid_l",
      ta2_latin: "Deltoideus",
      name_en: "Deltoid (left)",
      system: "muscular",
      path: ["Upper limb", "Shoulder"],
      mesh_file: "f.glb",
      node: "deltoid.l",
    },
    {
      organ_id: "orphan_muscle",
      ta2_latin: "Musculus solus",
      name_en: "Orphan muscle",
      system: "muscular",
      path: [],
      mesh_file: "f.glb",
      node: "orphan",
    },
  ];

  it("builds multi-level folder tree accurately", () => {
    const tree = buildHierarchyTree(organs);
    expect(tree.totalOrganCount).toBe(5);
    expect(tree.leafOrgans.length).toBe(1); // orphan muscle
    expect(tree.subfolders.length).toBe(1); // "Upper limb"

    const upperLimb = tree.subfolders[0]!;
    expect(upperLimb.label).toBe("Upper limb");
    expect(upperLimb.subfolders.length).toBe(2); // "Arm" and "Shoulder"

    const arm = upperLimb.subfolders.find((f) => f.label === "Arm")!;
    expect(arm).toBeDefined();
    expect(arm.subfolders.length).toBe(2); // Anterior and Posterior compartments
  });

  it("supports pathStartIndex to skip top-level category when grouping", () => {
    const tree = buildHierarchyTree(organs, 1); // skip "Upper limb"
    expect(tree.totalOrganCount).toBe(5);
    const subfolderLabels = tree.subfolders.map((f) => f.label);
    expect(subfolderLabels).toContain("Arm");
    expect(subfolderLabels).toContain("Shoulder");
  });
});

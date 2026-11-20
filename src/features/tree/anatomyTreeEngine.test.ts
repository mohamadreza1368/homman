import { describe, expect, it } from "vitest";
import {
  collectDescendantLeaves,
  normalizeSearchTerm,
  searchAnatomyNodes,
  traceAncestryPath,
  type AnatomyNodeRecord,
} from "./anatomyTreeEngine";

describe("Anatomy Tree & Search Engine (Specs-Derived Behavioral Tests)", () => {
  // Setup sample mock anatomy tree described in specs
  const mockNodes: AnatomyNodeRecord[] = [
    {
      id: "cardiovascular_system",
      nameFa: "دستگاه قلبی-عروقی",
      nameLatin: "Systema cardiovasculare",
      nameEn: "Cardiovascular system",
      childIds: ["heart"],
      isLeaf: false,
    },
    {
      id: "heart",
      nameFa: "قلب",
      nameLatin: "Cor",
      nameEn: "Heart",
      parentId: "cardiovascular_system",
      childIds: ["atria_group", "ventricles_group"],
      isLeaf: false,
    },
    {
      id: "atria_group",
      nameFa: "دهلیزها",
      nameLatin: "Atria",
      nameEn: "Atria",
      parentId: "heart",
      childIds: ["right_atrium", "left_atrium"],
      isLeaf: false,
    },
    {
      id: "ventricles_group",
      nameFa: "بطن‌ها",
      nameLatin: "Ventriculi",
      nameEn: "Ventricles",
      parentId: "heart",
      childIds: ["right_ventricle", "left_ventricle"],
      isLeaf: false,
    },
    {
      id: "right_atrium",
      nameFa: "دهلیز راست",
      nameLatin: "Atrium dextrum",
      nameEn: "Right atrium",
      parentId: "atria_group",
      childIds: [],
      isLeaf: true,
    },
    {
      id: "left_atrium",
      nameFa: "دهلیز چپ",
      nameLatin: "Atrium sinistrum",
      nameEn: "Left atrium",
      parentId: "atria_group",
      childIds: [],
      isLeaf: true,
    },
    {
      id: "right_ventricle",
      nameFa: "بطن راست",
      nameLatin: "Ventriculus dexter",
      nameEn: "Right ventricle",
      parentId: "ventricles_group",
      childIds: [],
      isLeaf: true,
    },
    {
      id: "left_ventricle",
      nameFa: "بطن چپ",
      nameLatin: "Ventriculus sinister",
      nameEn: "Left ventricle",
      parentId: "ventricles_group",
      childIds: ["mitral_valve"],
      isLeaf: false,
    },
    {
      id: "mitral_valve",
      nameFa: "دریچه میترال",
      nameLatin: "Valva mitralis",
      nameEn: "Mitral valve",
      parentId: "left_ventricle",
      childIds: [],
      isLeaf: true,
    },
    {
      id: "aorta",
      nameFa: "آئورت",
      nameLatin: "Aorta",
      nameEn: "Aorta",
      parentId: "cardiovascular_system",
      childIds: [],
      isLeaf: true,
    },
  ];

  const lookup = new Map<string, AnatomyNodeRecord>(
    mockNodes.map((n) => [n.id, n]),
  );

  it("Scenario 1: Breadth-First Search (BFS) leaf extraction for heart node", () => {
    // Expected to retrieve all leaf organs under heart
    const leaves = collectDescendantLeaves("heart", lookup);

    expect(leaves).toContain("right_atrium");
    expect(leaves).toContain("left_atrium");
    expect(leaves).toContain("right_ventricle");
    expect(leaves).toContain("mitral_valve");
    expect(leaves).not.toContain("aorta");
  });

  it("Scenario 2: Multilingual and Normalized Persian/Latin Search for 'بطن'", () => {
    const results = searchAnatomyNodes("بطن", mockNodes);

    const ids = results.map((r) => r.node.id);
    expect(ids).toContain("ventricles_group");
    expect(ids).toContain("right_ventricle");
    expect(ids).toContain("left_ventricle");
    expect(ids).not.toContain("aorta");
  });

  it("Scenario 3: Ancestry Path tracing from root to leaf", () => {
    const path = traceAncestryPath("mitral_valve", lookup);

    expect(path).toEqual([
      "cardiovascular_system",
      "heart",
      "ventricles_group",
      "left_ventricle",
      "mitral_valve",
    ]);
  });

  it("Edge Case A: Empty query returns empty results without crashing", () => {
    expect(searchAnatomyNodes("", mockNodes)).toEqual([]);
    expect(searchAnatomyNodes("   ", mockNodes)).toEqual([]);
  });

  it("Edge Case B: Non-existent query returns empty results cleanly", () => {
    const results = searchAnatomyNodes("خودرو", mockNodes);
    expect(results).toEqual([]);
  });

  it("Edge Case C: Persian and Arabic Yeh/Kaf normalization handles diverse keyboards", () => {
    expect(normalizeSearchTerm("كَبِد")).toBe("کبد");
    expect(normalizeSearchTerm("دِهْليز يمين")).toBe("دهلیز یمین");
    expect(normalizeSearchTerm("مِيتْرَال")).toBe("میترال");
  });

  it("Edge Case D: Non-existent node lookup returns empty leaf array safely", () => {
    const leaves = collectDescendantLeaves("non_existent_organ", lookup);
    expect(leaves).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  CONDUCTION_NODES,
  CONDUCTION_PATHS,
  PRECORDIAL_ELECTRODES,
  calculateNodeExcitation,
} from "./conductionSystem";

describe("conductionSystem", () => {
  it("contains essential cardiac conduction anatomical components", () => {
    const ids = CONDUCTION_NODES.map((n) => n.id);
    expect(ids).toContain("sa_node");
    expect(ids).toContain("av_node");
    expect(ids).toContain("bundle_of_his");
    expect(ids).toContain("right_bundle_branch");
    expect(ids).toContain("left_bundle_branch");
    expect(ids).toContain("purkinje_network");
  });

  it("calculates sequential electrical activation matching Guyton & Hall", () => {
    const saNode = CONDUCTION_NODES.find((n) => n.id === "sa_node")!;
    const avNode = CONDUCTION_NODES.find((n) => n.id === "av_node")!;
    const purkinje = CONDUCTION_NODES.find((n) => n.id === "purkinje_network")!;

    // At t = 0.04 (mid SA node fire), SA node excitation should be high (> 0.8)
    expect(calculateNodeExcitation(saNode, 0.04)).toBeGreaterThan(0.8);
    // While AV node and Purkinje are quiescent
    expect(calculateNodeExcitation(avNode, 0.04)).toBe(0);
    expect(calculateNodeExcitation(purkinje, 0.04)).toBe(0);

    // At t = 0.14 (mid AV delay), AV node should be excited
    expect(calculateNodeExcitation(avNode, 0.14)).toBeGreaterThan(0.8);
    expect(calculateNodeExcitation(saNode, 0.14)).toBe(0);

    // At t = 0.25, Purkinje network depolarizes ventricles
    expect(calculateNodeExcitation(purkinje, 0.25)).toBeGreaterThan(0.5);
  });

  it("contains all 6 AHA/IEC precordial chest leads V1-V6 with accurate anatomical landmarks", () => {
    expect(PRECORDIAL_ELECTRODES.length).toBe(6);
    const leads = PRECORDIAL_ELECTRODES.map((e) => e.lead);
    expect(leads).toEqual(["V1", "V2", "V3", "V4", "V5", "V6"]);

    const v1 = PRECORDIAL_ELECTRODES.find((e) => e.lead === "V1")!;
    expect(v1.anatomicalLandmarkEn).toContain("Fourth intercostal space");
    expect(v1.standardColorHex).toBe("#e53935");

    const v4 = PRECORDIAL_ELECTRODES.find((e) => e.lead === "V4")!;
    expect(v4.anatomicalLandmarkFa).toContain("فضای بین‌دنده‌ای پنجم");
    expect(v4.anatomicalLandmarkFa).toContain("میدکلاویکولار");
  });

  it("defines continuous conduction tracts across nodes", () => {
    expect(CONDUCTION_PATHS.length).toBeGreaterThanOrEqual(5);
    const tractIds = CONDUCTION_PATHS.map((p) => p.id);
    expect(tractIds).toContain("sa_to_av");
    expect(tractIds).toContain("av_to_his");
    expect(tractIds).toContain("his_to_rbb");
    expect(tractIds).toContain("his_to_lbb");
  });
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  CONDUCTION_NODES,
  PRECORDIAL_ELECTRODES,
} from "./conductionSystem";

describe("CardiacConductionLayer components", () => {
  it("verifies relative coordinate math for conduction nodes against cardiac center", () => {
    const mockCardiacCenter = new THREE.Vector3(0.02, 1.28, 0.04);
    const saNode = CONDUCTION_NODES.find((n) => n.id === "sa_node")!;
    const worldPos = new THREE.Vector3(
      mockCardiacCenter.x + saNode.relativeOffset[0],
      mockCardiacCenter.y + saNode.relativeOffset[1],
      mockCardiacCenter.z + saNode.relativeOffset[2]
    );

    expect(worldPos.y).toBeGreaterThan(mockCardiacCenter.y); // SA node is at superior aspect of atrium
    expect(worldPos.x).toBeLessThan(mockCardiacCenter.x); // Right atrium is anatomically on right (negative X in standard atlas)
  });

  it("verifies precordial leads position sequentially from sternum to axilla", () => {
    const v1 = PRECORDIAL_ELECTRODES.find((e) => e.lead === "V1")!;
    const v2 = PRECORDIAL_ELECTRODES.find((e) => e.lead === "V2")!;
    const v4 = PRECORDIAL_ELECTRODES.find((e) => e.lead === "V4")!;
    const v6 = PRECORDIAL_ELECTRODES.find((e) => e.lead === "V6")!;

    // V1 is right of sternum (negative X), V2 is left of sternum (positive X)
    expect(v1.relativePosition[0]).toBeLessThan(0);
    expect(v2.relativePosition[0]).toBeGreaterThan(0);

    // V4 and V6 move further left laterally
    expect(v4.relativePosition[0]).toBeGreaterThan(v2.relativePosition[0]);
    expect(v6.relativePosition[0]).toBeGreaterThan(v4.relativePosition[0]);

    // V6 is in midaxillary line, so Z depth is less anterior than V1/V2
    expect(v6.relativePosition[2]).toBeLessThan(v1.relativePosition[2]);
  });
});

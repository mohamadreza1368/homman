import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";

import { useSceneStore } from "@/stores/sceneStore";
import { LabelOverlay, labelTargets } from "./LabelOverlay";
import { setViewerHandle } from "./viewerBridge";

describe("LabelOverlay", () => {
  beforeEach(() => {
    useSceneStore.setState({
      organs: {
        heart: {
          organ_id: "heart",
          ta2_latin: "Cor",
          name_en: "Heart",
          system: "cardiovascular",
          mesh_file: "cardiovascular.glb",
          node: "Heart",
          path: [],
        },
      },
      selectedOrganIds: [],
      isolatedOrganIds: null,
      labelsVisible: false,
      focusBadge: null,
      background: "dark",
    });
    setViewerHandle(null);
  });

  it("returns selected organ target when exactly 1 organ is selected and labels are off", () => {
    const organMap = useSceneStore.getState().organs;
    const targets = labelTargets(organMap, ["heart"], null, false);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.id).toBe("heart");
    expect(targets[0]?.text).toMatch(/heart|cor|قلب/i);
  });

  it("renders leader line and anchor pin dot when an organ is selected", () => {
    useSceneStore.setState({ selectedOrganIds: ["heart"] });

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2);
    camera.lookAt(0, 0, 0);

    const centres = new Map<string, THREE.Vector3>([["heart", new THREE.Vector3(0, 0, 0)]]);
    const offsets = new Map<string, THREE.Vector3>();

    setViewerHandle({
      gl: {} as THREE.WebGLRenderer,
      scene: new THREE.Scene(),
      camera,
      centres,
      offsets,
      controls: null,
    });

    const { container } = render(<LabelOverlay />);
    expect(screen.getByText(/heart|cor|قلب/i)).toBeTruthy();
    expect(container.querySelector("line")).toBeTruthy();
    expect(container.querySelector("circle")).toBeTruthy();
  });
});

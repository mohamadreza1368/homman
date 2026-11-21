/**
 * HOOMAAN 3D Viewer - Dynamic Clipping Plane Synthesizer
 * Computes bounding-box relative cutting planes along anatomical orthogonal axes.
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { CrossSection } from "@/stores/sceneStore";
import type { SectionPlane } from "@/lib/schemas";

const PLANE_DIRECTION_VECTORS: Record<SectionPlane, THREE.Vector3> = {
  sagittal: new THREE.Vector3(-1, 0, 0),
  coronal: new THREE.Vector3(0, 0, -1),
  axial: new THREE.Vector3(0, -1, 0),
};

const AXIS_MAP: Record<SectionPlane, "x" | "y" | "z"> = {
  sagittal: "x",
  coronal: "z",
  axial: "y",
};

export function useClippingSection(
  crossSection: CrossSection | null,
  bounds: THREE.Box3 | null,
): THREE.Plane[] {
  return useMemo(() => {
    if (!crossSection) return [];

    const norm = PLANE_DIRECTION_VECTORS[crossSection.plane].clone();
    let planeDistance = crossSection.position;

    if (bounds && !bounds.isEmpty()) {
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const axis = AXIS_MAP[crossSection.plane];
      planeDistance = -(center[axis] + (crossSection.position * size[axis]) * 0.5) * norm[axis];
    }

    return [new THREE.Plane(norm, planeDistance)];
  }, [crossSection, bounds]);
}

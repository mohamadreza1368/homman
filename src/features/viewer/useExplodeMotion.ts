/**
 * Hoomaan 3D Viewer - Smooth Animation Loop for Exploded View
 */

import { useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import * as THREE from "three";

interface RegisteredMesh {
  mesh: THREE.Mesh;
  base: THREE.Matrix4;
}

const SETTLED_SQ = 1e-8;
const EASING_RATE = 0.005;
const MAX_DELTA_SEC = 0.1;

const ZERO_VEC = new THREE.Vector3();
const tmpOffset = new THREE.Vector3();
const tmpPosition = new THREE.Vector3();

/**
 * Registers meshes and animates their positions toward targets specified by explode offsets.
 */
export function useExplodeMotion(
  offsets: Map<string, THREE.Vector3>,
): (organId: string, mesh: THREE.Mesh | null, base: THREE.Matrix4) => void {
  const registered = useRef(new Map<string, RegisteredMesh>());
  const currentPositions = useRef(new Map<string, THREE.Vector3>());

  const register = useCallback(
    (organId: string, mesh: THREE.Mesh | null, base: THREE.Matrix4) => {
      if (mesh) {
        registered.current.set(organId, { mesh, base });
        return;
      }
      registered.current.delete(organId);
      currentPositions.current.delete(organId);
    },
    [],
  );

  useFrame((_, delta) => {
    if (offsets.size === 0 && currentPositions.current.size === 0) return;

    const lerpAlpha = 1 - Math.pow(EASING_RATE, Math.min(delta, MAX_DELTA_SEC));
    const parentInverses = new Map<THREE.Object3D, THREE.Matrix4>();

    const updateStructure = (organId: string, targetVec: THREE.Vector3 | undefined) => {
      const entry = registered.current.get(organId);
      if (!entry) return;

      let pos = currentPositions.current.get(organId);
      if (!pos) {
        if (!targetVec) return;
        pos = new THREE.Vector3();
        currentPositions.current.set(organId, pos);
      }

      const dest = targetVec ?? ZERO_VEC;
      const arrived = pos.distanceToSquared(dest) < SETTLED_SQ;
      if (arrived) {
        pos.copy(dest);
      } else {
        pos.lerp(dest, lerpAlpha);
      }

      let localOffset = pos;
      const parentObj = entry.mesh.parent;
      if (parentObj) {
        let inv = parentInverses.get(parentObj);
        if (!inv) {
          inv = new THREE.Matrix4()
            .copy(parentObj.matrixWorld)
            .invert()
            .setPosition(0, 0, 0);
          parentInverses.set(parentObj, inv);
        }
        localOffset = tmpOffset.copy(pos).applyMatrix4(inv);
      }

      tmpPosition.setFromMatrixPosition(entry.base).add(localOffset);
      entry.mesh.matrix.copy(entry.base).setPosition(tmpPosition);
      entry.mesh.matrixWorldNeedsUpdate = true;

      if (arrived && !targetVec) {
        currentPositions.current.delete(organId);
      }
    };

    for (const [organId, target] of offsets) {
      updateStructure(organId, target);
    }
    for (const organId of currentPositions.current.keys()) {
      if (!offsets.has(organId)) {
        updateStructure(organId, undefined);
      }
    }
  });

  return register;
}

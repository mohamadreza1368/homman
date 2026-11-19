import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { clampGaze, type EyeGroup } from "./eyes";

/**
 * HOOMAAN Anatomical Ocular Globe Kinematics.
 * Groups multi-part ocular structures (cornea, iris, sclera, lens, retina)
 * around an anatomical pivot and smoothly orients them toward the camera.
 */

const MAX_GAZE_RADIANS = (35 * Math.PI) / 180;
const DAMPING_FACTOR = 6;

export function EyeGlobe({
  eye,
  enabled,
  children,
}: {
  eye: EyeGroup;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const containerRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const targetRotation = useRef(new THREE.Quaternion());
  const lookVector = useRef(new THREE.Vector3());
  const defaultRotation = useRef(new THREE.Quaternion());

  useFrame((_, delta) => {
    const groupNode = containerRef.current;
    if (!groupNode) return;

    if (enabled) {
      lookVector.current.copy(camera.position).sub(eye.centre);
      if (lookVector.current.lengthSq() < 1e-12) return;

      const boundedGaze = clampGaze(eye.restForward, lookVector.current, MAX_GAZE_RADIANS);
      targetRotation.current.setFromUnitVectors(eye.restForward, boundedGaze);
    } else {
      targetRotation.current.copy(defaultRotation.current);
    }

    const slerpAlpha = 1 - Math.exp(-DAMPING_FACTOR * delta);
    groupNode.quaternion.slerp(targetRotation.current, slerpAlpha);
  });

  return (
    <group ref={containerRef} position={eye.centre}>
      {children}
    </group>
  );
}

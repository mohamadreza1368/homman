import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { FocusRequest, ViewpointRequest } from "@/stores/sceneStore";
import { framingDistance, scanStance, viewDirection } from "./cameraViews";
import { studyEnvelope } from "./supply";

export interface CameraRigProps {
  focusRequest: FocusRequest | null;
  viewpoint: ViewpointRequest | null;
  centres: Map<string, THREE.Vector3>;
  offsets: Map<string, THREE.Vector3>;
  boxes: React.RefObject<Map<string, THREE.Box3>>;
  isolatedOrganIds: string[] | null;
  leftSign: 1 | -1;
  bounds: THREE.Box3 | null;
  finestDetail: number;
}

export function CameraRig({
  focusRequest,
  viewpoint,
  centres,
  offsets,
  boxes,
  isolatedOrganIds,
  leftSign,
  bounds,
  finestDetail,
}: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const targetGoal = useRef(new THREE.Vector3());
  const positionGoal = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const lastFocusSeq = useRef(-1);
  const lastViewpointSeq = useRef(-1);
  const hasInitializedFraming = useRef(false);
  const activeEasingMode = useRef<"none" | "target" | "both">("none");

  useEffect(() => {
    if (!bounds || bounds.isEmpty() || hasInitializedFraming.current) return;
    hasInitializedFraming.current = true;

    const center = bounds.getCenter(new THREE.Vector3());
    const sz = bounds.getSize(new THREE.Vector3());
    const rad = Math.max(sz.x, sz.y, sz.z, 1e-4) * 0.5;

    const perspective = camera as THREE.PerspectiveCamera;
    const initialDistance = (rad * 2.2) / Math.tan((perspective.fov * Math.PI) / 360);

    targetGoal.current.copy(center);
    camera.position.set(center.x, center.y + rad * 0.3, center.z + initialDistance);

    perspective.near = Math.max(finestDetail / 20, 1e-5);
    perspective.far = initialDistance * 20;
    perspective.updateProjectionMatrix();

    const orbit = controlsRef.current;
    if (orbit) {
      orbit.target.copy(center);
      orbit.minDistance = Math.max(finestDetail * 1.5, 1e-4);
      orbit.maxDistance = initialDistance * 8;
      orbit.update();
    }
  }, [bounds, camera, finestDetail]);

  useEffect(() => {
    if (!focusRequest || focusRequest.seq === lastFocusSeq.current) return;
    const center = centres.get(focusRequest.organId);
    if (!center) return;
    lastFocusSeq.current = focusRequest.seq;
    targetGoal.current.copy(center);

    const displacement = offsets.get(focusRequest.organId);
    if (displacement) targetGoal.current.add(displacement);
    activeEasingMode.current = "target";
  }, [focusRequest, centres, offsets]);

  useEffect(() => {
    const orbit = controlsRef.current;
    if (!viewpoint || !orbit || viewpoint.seq === lastViewpointSeq.current) return;
    lastViewpointSeq.current = viewpoint.seq;

    const perspective = camera as THREE.PerspectiveCamera;
    const relativeOffset = camera.position.clone().sub(orbit.target);
    const currentDist = relativeOffset.length();

    if (viewpoint.kind === "dolly") {
      const clampedDist = THREE.MathUtils.clamp(
        currentDist * viewpoint.factor,
        orbit.minDistance,
        orbit.maxDistance,
      );
      targetGoal.current.copy(orbit.target);
      positionGoal.current
        .copy(orbit.target)
        .add(relativeOffset.normalize().multiplyScalar(clampedDist));
    } else if (viewpoint.kind === "orient" || viewpoint.kind === "scan") {
      targetGoal.current.copy(orbit.target);
      const directionVec =
        viewpoint.kind === "scan" ? scanStance() : viewDirection(viewpoint.view, leftSign);
      positionGoal.current
        .copy(orbit.target)
        .add(directionVec.multiplyScalar(currentDist));
    } else {
      const framingBox = studyEnvelope(
        isolatedOrganIds ?? boxes.current.keys(),
        boxes.current,
      );
      if (!framingBox) return;
      const center = framingBox.getCenter(new THREE.Vector3());
      const sz = framingBox.getSize(new THREE.Vector3());
      const rad = Math.max(sz.x, sz.y, sz.z, 1e-4) * 0.5;

      targetGoal.current.copy(center);
      positionGoal.current
        .copy(center)
        .add(
          relativeOffset
            .normalize()
            .multiplyScalar(framingDistance(rad, perspective.fov)),
        );
    }

    activeEasingMode.current = "both";
  }, [viewpoint, camera, isolatedOrganIds, leftSign]);

  useFrame((_, delta) => {
    const orbit = controlsRef.current;
    if (!orbit || activeEasingMode.current === "none") return;

    const alpha = 1 - Math.pow(0.005, delta);
    orbit.target.lerp(targetGoal.current, alpha);
    if (activeEasingMode.current === "both") {
      camera.position.lerp(positionGoal.current, alpha);
    }
    orbit.update();

    const isSettled =
      orbit.target.distanceToSquared(targetGoal.current) < 1e-8 &&
      (activeEasingMode.current === "target" ||
        camera.position.distanceToSquared(positionGoal.current) < 1e-8);

    if (isSettled) {
      orbit.target.copy(targetGoal.current);
      if (activeEasingMode.current === "both") {
        camera.position.copy(positionGoal.current);
      }
      orbit.update();
      activeEasingMode.current = "none";
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      camera={camera}
      enableDamping
      dampingFactor={0.08}
      zoomToCursor
      screenSpacePanning
      enablePan
      panSpeed={1.2}
      makeDefault
      onStart={() => {
        activeEasingMode.current = "none";
      }}
    />
  );
}

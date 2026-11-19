import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { PathwayRequest } from "@/stores/sceneStore";

/**
 * HOOMAAN Physiological Pathway Flow Animation.
 * Traces smooth centripetal spline curves through anatomical waypoint coordinates
 * with pulsing kinetic markers and semi-transparent luminescent tubes.
 */

const PATH_TUBE_COLOR = "#c86bff";
const TUBE_RADIUS_RATIO = 0.004;
const MARKER_RADIUS_RATIO = 0.013;
const TUBE_RADIAL_SEGMENTS = 8;
const SEGMENTS_PER_WAYPOINT = 14;

interface ComputedRoute {
  curve: THREE.CatmullRomCurve3;
  stops: number;
}

export function PathwayFlow({
  pathway,
  centres,
  centresRevision,
  modelScale,
}: {
  pathway: PathwayRequest;
  centres: Map<string, THREE.Vector3>;
  centresRevision: number;
  modelScale: number;
}) {
  const route = useMemo<ComputedRoute | null>(() => {
    void centresRevision;

    const points: THREE.Vector3[] = [];
    const missingIds: string[] = [];

    for (const id of pathway.organIds) {
      const pos = centres.get(id);
      if (pos) {
        points.push(pos.clone());
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      console.warn(
        `[HOOMAAN Pathway] Skipped unmounted anatomical structures: ${missingIds.join(", ")}`,
      );
    }

    const uniquePoints = points.filter(
      (p, i) => i === 0 || p.distanceToSquared(points[i - 1]!) > 1e-12,
    );
    if (uniquePoints.length < 2) return null;

    return {
      curve: new THREE.CatmullRomCurve3(uniquePoints, false, "centripetal", 0.5),
      stops: uniquePoints.length,
    };
  }, [pathway, centres, centresRevision]);

  const tubeGeometry = useMemo(() => {
    if (!route) return null;
    return new THREE.TubeGeometry(
      route.curve,
      route.stops * SEGMENTS_PER_WAYPOINT,
      modelScale * TUBE_RADIUS_RATIO,
      TUBE_RADIAL_SEGMENTS,
      false,
    );
  }, [route, modelScale]);

  useEffect(() => () => tubeGeometry?.dispose(), [tubeGeometry]);

  const markerRef = useRef<THREE.Mesh>(null);
  const totalElapsed = useRef(0);
  const currentPos = useRef(new THREE.Vector3());

  useEffect(() => {
    totalElapsed.current = 0;
  }, [pathway.seq, route]);

  useFrame((_, delta) => {
    const meshNode = markerRef.current;
    if (!route || !meshNode) return;

    totalElapsed.current += delta;
    const duration = Math.max((route.stops - 1) * pathway.stepSeconds, pathway.stepSeconds);
    const progress = totalElapsed.current / duration;

    const t = pathway.loop ? progress % 1 : Math.min(progress, 1);
    route.curve.getPoint(t, currentPos.current);
    meshNode.position.copy(currentPos.current);

    const pulseScale = 1 + Math.sin(totalElapsed.current * 5.5) * 0.16;
    meshNode.scale.setScalar(pulseScale);
  });

  if (!route || !tubeGeometry) return null;

  return (
    <group>
      <mesh geometry={tubeGeometry} renderOrder={2}>
        <meshBasicMaterial
          color={PATH_TUBE_COLOR}
          transparent
          opacity={0.34}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={markerRef} renderOrder={3}>
        <sphereGeometry args={[modelScale * MARKER_RADIUS_RATIO, 16, 16]} />
        <meshBasicMaterial
          color={PATH_TUBE_COLOR}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { ManifestOrgan } from "@/lib/schemas";
import { useBreathStore } from "@/stores/breathStore";
import { useSceneStore } from "@/stores/sceneStore";
import {
  BREATH_AXIS,
  BREATH_FILL,
  BREATH_FRAME,
  BREATH_PATTERNS,
  BREATH_ROLE,
  breathFill,
  breathingIn,
  breathRole,
} from "./breathing";
import { CARRY_VERSION, carryPlacement, measureCarry } from "./breathCarry";
import { beatChamber, isChamberWall } from "./heartbeat";
import { sinusPace } from "./sinusArrhythmia";

/**
 * HOOMAAN Respiratory Kinematics Driver.
 * Synchronizes anatomical chest expansion, rib swinging axis, organ-carried
 * vasculature motion, and respiratory sinus arrhythmia.
 */

const EASE_TIME_S = 1;
const CARRY_SETTLE_FRAMES = 20;
const CARRY_STILL_THRESHOLD_M = 1e-5;
const CARRY_MOVED_THRESHOLD_M = 0.002;

export const BREATH_NOW = { inhaling: false, running: false, swing: 0 };

type Measured = Pick<ManifestOrgan, "organ_id" | "system" | "name_en" | "ta2_latin" | "path">;

export function breathFrame(
  boxes: ReadonlyMap<string, THREE.Box3>,
  organs: Iterable<Measured>,
  sternumY: number,
): [number, number, number] {
  const lungsBounds = new THREE.Box3();
  const heartBounds = new THREE.Box3();

  for (const organ of organs) {
    const box = boxes.get(organ.organ_id);
    if (!box || box.isEmpty()) continue;
    if (organ.system === "respiratory" && breathRole(organ) === BREATH_ROLE.lung) {
      lungsBounds.union(box);
    } else if (beatChamber(organ) !== null && isChamberWall(organ)) {
      heartBounds.union(box);
    }
  }

  return [
    lungsBounds.isEmpty() ? sternumY - 0.16 : lungsBounds.min.y,
    lungsBounds.isEmpty() ? sternumY + 0.14 : lungsBounds.max.y,
    heartBounds.isEmpty() ? sternumY + 0.04 : heartBounds.max.y,
  ];
}

export function BreathDriver({
  boxes,
  bounds,
  revision,
}: {
  boxes: Map<string, THREE.Box3>;
  bounds: THREE.Box3 | null;
  revision: number;
}) {
  const thoracicAxis = useMemo(() => {
    const sternum = boxes.get("body_of_sternum");
    if (sternum) {
      const center = sternum.getCenter(new THREE.Vector3());
      return [center.x, center.y, sternum.max.z - 0.1];
    }
    if (bounds && !bounds.isEmpty()) {
      const sz = bounds.getSize(new THREE.Vector3());
      const mid = bounds.getCenter(new THREE.Vector3());
      return [mid.x, bounds.min.y + sz.y * 0.73, mid.z];
    }
    return [0, 1.32, 0];
  }, [boxes, bounds, revision]);

  useEffect(() => {
    BREATH_AXIS.value = thoracicAxis;
  }, [thoracicAxis]);

  const sceneOrgans = useSceneStore((s) => s.organs);
  useEffect(() => {
    BREATH_FRAME.value = breathFrame(boxes, Object.values(sceneOrgans), thoracicAxis[1]!);
  }, [boxes, sceneOrgans, thoracicAxis, revision]);

  const internalClock = useRef(0);
  const currentAmplitude = useRef(0);
  const carryState = useRef({ version: -1, revision: -1, placement: Number.NaN });
  const carryStability = useRef({ version: -1, placement: Number.NaN, frames: 0 });
  const activeDepth = useRef(1);
  const activeSinusSwing = useRef(BREATH_PATTERNS.quiet.sinusSwing);

  useEffect(() => {
    return () => {
      BREATH_FILL.value = 0;
      BREATH_NOW.running = false;
      BREATH_NOW.swing = 0;
    };
  }, []);

  useFrame((_, delta) => {
    const { enabled, pattern: patternId } = useBreathStore.getState();
    const pattern = BREATH_PATTERNS[patternId];

    if (!enabled && currentAmplitude.current === 0) {
      if (BREATH_NOW.running) {
        BREATH_FILL.value = 0;
        BREATH_NOW.running = false;
        BREATH_NOW.swing = 0;
        internalClock.current = 0;
      }
      return;
    }

    const currentVersion = CARRY_VERSION.value;
    const currentPlacement = carryPlacement();
    const stability = carryStability.current;
    const isMotionless =
      currentVersion === stability.version &&
      Math.abs(currentPlacement - stability.placement) < CARRY_STILL_THRESHOLD_M;

    stability.frames = isMotionless ? stability.frames + 1 : 0;
    stability.version = currentVersion;
    stability.placement = currentPlacement;

    const previousCarry = carryState.current;
    const hasStructureChanged =
      currentVersion !== previousCarry.version ||
      revision !== previousCarry.revision ||
      !(Math.abs(currentPlacement - previousCarry.placement) < CARRY_MOVED_THRESHOLD_M);

    if (hasStructureChanged && stability.frames >= CARRY_SETTLE_FRAMES) {
      carryState.current = { version: currentVersion, revision, placement: currentPlacement };
      measureCarry();
    }

    const dt = Math.min(delta, 0.05);
    internalClock.current += dt;
    const currentFill = breathFill(internalClock.current, pattern);
    const isInhaling = breathingIn(internalClock.current, pattern);

    if (enabled) {
      currentAmplitude.current = Math.min(1, currentAmplitude.current + dt / EASE_TIME_S);
    } else if (!isInhaling) {
      currentAmplitude.current = Math.max(0, currentAmplitude.current - dt / EASE_TIME_S);
      if (currentFill < 0.02) currentAmplitude.current = 0;
    }

    activeDepth.current += (pattern.depth - activeDepth.current) * Math.min(1, dt * 1.5);
    activeSinusSwing.current +=
      (pattern.sinusSwing - activeSinusSwing.current) * Math.min(1, dt * 1.5);

    BREATH_FILL.value = currentFill * currentAmplitude.current * activeDepth.current;
    BREATH_NOW.inhaling = isInhaling;
    BREATH_NOW.running = currentAmplitude.current > 0;
    BREATH_NOW.swing =
      currentAmplitude.current *
      activeSinusSwing.current *
      sinusPace(internalClock.current, pattern);
  });

  return null;
}

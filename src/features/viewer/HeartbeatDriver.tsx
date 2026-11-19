import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { ManifestOrgan } from "@/lib/schemas";
import { useHeartStore } from "@/stores/heartStore";
import { useSceneStore } from "@/stores/sceneStore";
import {
  BEAT_ATRIA,
  BEAT_BASE_ATRIA,
  BEAT_BASE_VENTRICLES,
  BEAT_GLOW,
  BEAT_LIGHT_ATRIA,
  BEAT_LIGHT_VENTRICLES,
  BEAT_REACH_ATRIA,
  BEAT_REACH_VENTRICLES,
  BEAT_VENTRICLES,
  BEATING,
  BEATING_VERSION,
  chamberCentres,
  chamberHolds,
  HEART_PROBE,
  SEAM_ATTRIBUTE,
  SQUEEZE,
  seamFreedom,
  seamGrid,
  type BeatingMesh,
  type ChamberPoints,
} from "./heartbeat";
import {
  FLOW_CHAMBER,
  FLOW_PATH_ATTRIBUTE,
  FLOW_PROBE,
  FLOW_SOURCES,
  FLOW_UNIFORMS,
  FLOWING,
  FLOWING_VERSION,
  PulseTrain,
  type FlowKind,
} from "./bloodFlow";
import { BREATH_NOW } from "./BreathDriver";
import { HEART_TRACE } from "./EcgStrip";
import { flowPaths, type PathMesh } from "./flowPaths";
import { LightGuard, prefersReducedMotion } from "./lightGuard";
import { playDub, playExtra, playLub, playMurmur } from "./heartSound";
import { rhythm, RhythmPlayer } from "./rhythms";
import { BreathPacer } from "./sinusArrhythmia";

/**
 * HOOMAAN Cardiac Dynamics Driver.
 * Coordinates atrial and ventricular contraction cycles, pulse wave emission,
 * cardiac seam freedom vertex attributes, vessel distance flow maps,
 * arrhythmia sound synthesis, and ECG waveform tracking.
 */

const MAX_FRAME_DELTA_S = 0.1;
const PATH_SETTLE_FRAMES = 20;

function extractChamberPoints(entry: BeatingMesh): ChamberPoints {
  return {
    chamber: entry.chamber,
    vertices: entry.mesh.geometry.getAttribute("position"),
    matrixWorld: entry.mesh.matrixWorld,
  };
}

function computeCardiacSeams(): void {
  const t0 = performance.now();
  const chamberWalls: ChamberPoints[] = [];
  for (const item of BEATING.values()) {
    if (item.wall) chamberWalls.push(extractChamberPoints(item));
  }
  const grid = seamGrid(chamberWalls);
  for (const item of BEATING.values()) {
    const freedom = seamFreedom(grid, extractChamberPoints(item));
    item.mesh.geometry.setAttribute(SEAM_ATTRIBUTE, new THREE.BufferAttribute(freedom, 1));
  }
  HEART_PROBE.seamMs = performance.now() - t0;
}

function computeVesselFlowPaths(chamberCenters: ReadonlyMap<string, THREE.Vector3>): void {
  const t0 = performance.now();
  let vertexTotal = 0;

  for (const type of Object.keys(FLOW_CHAMBER) as FlowKind[]) {
    const rootCenter = chamberCenters.get(FLOW_CHAMBER[type]);
    const vesselList = [...FLOWING.values()].filter((item) => item.kind === type);
    if (!rootCenter || vesselList.length === 0) continue;

    const pathMeshes: PathMesh[] = vesselList.map((item) => {
      item.mesh.updateWorldMatrix(true, false);
      const posAttr = item.mesh.geometry.getAttribute("position");
      vertexTotal += posAttr.count;
      return { vertices: posAttr, matrixWorld: item.mesh.matrixWorld, seed: item.seed };
    });

    const distances = flowPaths(pathMeshes, rootCenter);
    vesselList.forEach((item, idx) => {
      item.mesh.geometry.setAttribute(
        FLOW_PATH_ATTRIBUTE,
        new THREE.BufferAttribute(distances[idx]!, 1),
      );
    });
  }

  FLOW_PROBE.pathMs = performance.now() - t0;
  FLOW_PROBE.vertices = vertexTotal;
}

export function HeartbeatDriver({
  boxes,
  organs,
  revision,
}: {
  boxes: ReadonlyMap<string, THREE.Box3>;
  organs: readonly ManifestOrgan[];
  revision: number;
}) {
  const enabled = useHeartStore((s) => s.enabled);
  const rhythmId = useHeartStore((s) => s.rhythm);

  const centers = useMemo(
    () => (enabled ? chamberCentres(boxes, organs) : null),
    [enabled, boxes, organs, revision],
  );

  useEffect(() => {
    if (!enabled) return;
    const holds = chamberHolds(boxes, organs);
    BEAT_BASE_ATRIA.value = holds.atria?.base ?? 0;
    BEAT_REACH_ATRIA.value = holds.atria?.reach ?? 0;
    BEAT_BASE_VENTRICLES.value = holds.ventricles?.base ?? 0;
    BEAT_REACH_VENTRICLES.value = holds.ventricles?.reach ?? 0;
  }, [enabled, boxes, organs, revision]);

  const cardiacClock = useRef(0);
  const wallClock = useRef(0);
  const isResting = useRef(true);
  const respiratoryPacer = useMemo(() => new BreathPacer(), []);
  const lastSeamVersion = useRef(-1);
  const lastFlowVersion = useRef(-1);
  const flowStability = useRef({ version: -1, frames: 0 });
  const activePlayer = useRef<RhythmPlayer | null>(null);
  const pulses = useMemo(() => new PulseTrain(), []);
  const guards = useMemo(() => ({ atria: new LightGuard(), ventricles: new LightGuard() }), []);
  const invMatrix = useMemo(() => new THREE.Matrix4(), []);

  useEffect(() => {
    activePlayer.current = null;
    cardiacClock.current = 0;
    wallClock.current = 0;
    isResting.current = true;
    respiratoryPacer.reset();
    HEART_TRACE.clock.reset();
    pulses.reset();
  }, [rhythmId, pulses, respiratoryPacer]);

  useEffect(() => {
    if (enabled) return;
    cardiacClock.current = 0;
    wallClock.current = 0;
    isResting.current = true;
    respiratoryPacer.reset();
    HEART_TRACE.clock.reset();
    lastSeamVersion.current = -1;
    lastFlowVersion.current = -1;
    activePlayer.current = null;
    BEAT_ATRIA.value = 0;
    BEAT_VENTRICLES.value = 0;
    BEAT_GLOW.value = 0;
    HEART_TRACE.player = null;
    BEAT_LIGHT_ATRIA.value = 0;
    BEAT_LIGHT_VENTRICLES.value = 0;
    guards.atria.reset();
    guards.ventricles.reset();
    pulses.reset();
    FLOW_UNIFORMS.uPulseStrength.value.fill(0);
    FLOW_UNIFORMS.uVenous.value = 0;
  }, [enabled, pulses, guards, respiratoryPacer]);

  useFrame((_, delta) => {
    if (!enabled || !centers) return;

    if (lastSeamVersion.current !== BEATING_VERSION.value) {
      lastSeamVersion.current = BEATING_VERSION.value;
      computeCardiacSeams();
    }

    const currentFlowVer = FLOWING_VERSION.value;
    if (currentFlowVer !== lastFlowVersion.current && FLOWING.size > 0) {
      const stableCheck = flowStability.current;
      if (stableCheck.version !== currentFlowVer) {
        stableCheck.version = currentFlowVer;
        stableCheck.frames = 0;
      } else if (++stableCheck.frames >= PATH_SETTLE_FRAMES) {
        lastFlowVersion.current = currentFlowVer;
        computeVesselFlowPaths(centers);
      }
    }

    const dt = Math.min(delta, MAX_FRAME_DELTA_S);
    const pattern = rhythm(rhythmId);
    const respiratoryOffset = BREATH_NOW.swing * (pattern.followsBreath ?? 0);
    const tStart = cardiacClock.current;
    const tEnd = tStart + respiratoryPacer.advance(dt, respiratoryOffset, isResting.current);
    cardiacClock.current = tEnd;
    wallClock.current += dt;
    const currentWallTime = wallClock.current;

    activePlayer.current ??= new RhythmPlayer(pattern);
    const cycle = activePlayer.current.advance(tStart, tEnd);
    isResting.current = cycle.atria === 0 && cycle.ventricles === 0;

    HEART_TRACE.player = activePlayer.current;
    HEART_TRACE.now = currentWallTime;
    HEART_TRACE.clock.push(currentWallTime, tEnd);

    BEAT_ATRIA.value = cycle.atria;
    BEAT_VENTRICLES.value = cycle.ventricles;

    for (const item of BEATING.values()) {
      const c = centers.get(item.chamber);
      if (!c) continue;
      item.centre.value.copy(c).applyMatrix4(invMatrix.copy(item.mesh.matrixWorld).invert());
    }

    BEAT_GLOW.value = (useSceneStore.getState().systemOpacity.cardiovascular ?? 1) < 1 ? 1 : 0;
    const reducedMotion = prefersReducedMotion();
    BEAT_LIGHT_ATRIA.value = guards.atria.next(
      currentWallTime,
      dt,
      cycle.atria / SQUEEZE.atria,
      reducedMotion,
    );
    BEAT_LIGHT_VENTRICLES.value = guards.ventricles.next(
      currentWallTime,
      dt,
      cycle.ventricles / SQUEEZE.ventricles,
      reducedMotion,
    );
    FLOW_UNIFORMS.uFlowSteady.value = guards.ventricles.steady ? 1 : 0;

    for (const intensity of cycle.lub) pulses.launch(currentWallTime, intensity);
    pulses.advance(
      currentWallTime,
      dt,
      FLOW_UNIFORMS.uPulseAge.value,
      FLOW_UNIFORMS.uPulseStrength.value,
    );
    FLOW_UNIFORMS.uVenous.value = pulses.venous;
    FLOW_UNIFORMS.uFlowTime.value = currentWallTime;

    for (const kind of Object.keys(FLOW_CHAMBER) as FlowKind[]) {
      const chamberCoord = centers.get(FLOW_CHAMBER[kind]);
      if (chamberCoord) FLOW_SOURCES[kind].value.copy(chamberCoord);
    }

    if (useHeartStore.getState().sound) {
      for (const val of cycle.lub) playLub(val);
      for (const val of cycle.dub) playDub(val);
      for (const murmur of cycle.murmurs) playMurmur(murmur);
      for (const ext of cycle.extras) playExtra(ext);
    }
  });

  return null;
}

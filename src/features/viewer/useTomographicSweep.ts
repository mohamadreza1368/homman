/**
 * HOOMAAN 3D Viewer - Tomographic Sweep & Plane Traversal Orchestrator
 * Coordinates scan band motion along spatial bounding boxes, triggering
 * tactile crossing readouts and axial reconstruction requests.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import {
  advanceScanBand,
  advanceScanEntry,
  advanceScanPulse,
  firePulse,
  holdScanBand,
  resetScanBand,
  resetScanEntry,
  scanFractionFor,
  scanRangeAlong,
  SCAN_TRAVEL_M,
  setScanGhost,
  setScanReveal,
  setScanTint,
  SHARED_SCAN,
  setScanPlane,
  sweepAxis,
} from "./scanBand";
import { depthLabel, SECTION_VIEW, SECTION_WANTED, wantSection } from "./axialSlice";
import { scanTint } from "./scanTints";
import { CURRENT_LEVEL, levelAt } from "./vertebralLevel";
import { playScanPing } from "./scanSound";
import {
  CROSSING_INTERVAL_S,
  CROSSING_LIMIT,
  CURRENT_CROSSING,
  crossingAt,
  NOTHING_CROSSED,
  sameCrossing,
  SWEEP_RUNNING,
} from "./scanCrossing";
import { useSceneStore } from "@/stores/sceneStore";
import { scanIsStill, useScanStore } from "@/stores/scanStore";

export function useTomographicSweep(
  isScanBandActive: boolean,
  manualScanActive: boolean,
  sceneBounds: THREE.Box3 | null,
  boxesRef: React.RefObject<Map<string, THREE.Box3>>,
  centersRevision: number,
) {
  const triggerScanView = useSceneStore((s) => s.scanView);
  const activeTint = useScanStore((s) => s.tint);
  const isRevealMode = useScanStore((s) => s.reveal);
  const isGhostMode = useScanStore((s) => s.ghost);
  const axialDetailSetting = useScanStore((s) => s.detail);
  const activeScanPlane = useScanStore((s) => s.plane);

  const assistantScanRequest = useSceneStore((s) => s.scanRequest);
  const lastProcessedScanSeq = useRef(0);

  const wasScannerGrabbed = useRef(false);
  const axialRequestCounter = useRef(0);
  const [axialRunCount, setAxialRunCount] = useState(0);
  const lastObservedSectionWanted = useRef(SECTION_WANTED.value);
  const timeSinceLastCrossing = useRef(0);

  useEffect(() => {
    resetScanBand();
    if (manualScanActive) triggerScanView();
  }, [manualScanActive, triggerScanView]);

  useEffect(() => {
    if (isScanBandActive) resetScanEntry();
  }, [isScanBandActive]);

  useEffect(() => {
    setScanTint(scanTint(activeTint).light);
  }, [activeTint]);

  useEffect(() => {
    setScanReveal(isRevealMode);
  }, [isRevealMode]);

  useEffect(() => {
    setScanGhost(isGhostMode);
  }, [isGhostMode]);

  useEffect(() => {
    if (!assistantScanRequest || assistantScanRequest.seq === lastProcessedScanSeq.current) return;
    if (!sceneBounds || sceneBounds.isEmpty()) return;
    const targetBox = boxesRef.current?.get(assistantScanRequest.organId);
    if (!targetBox) return;
    lastProcessedScanSeq.current = assistantScanRequest.seq;

    if (assistantScanRequest.plane) {
      const targetPlane = assistantScanRequest.plane === "coronal" ? "front" : "axial";
      if (useScanStore.getState().plane !== targetPlane) {
        useScanStore.getState().setPlane(targetPlane);
        SECTION_VIEW.value = null;
      }
    }

    const axis = sweepAxis(useScanStore.getState().plane);
    const { from, to } = scanRangeAlong(
      [sceneBounds.min.x, sceneBounds.min.y, sceneBounds.min.z],
      [sceneBounds.max.x, sceneBounds.max.y, sceneBounds.max.z],
      axis,
    );

    const targetSpan = scanRangeAlong(
      [targetBox.min.x, targetBox.min.y, targetBox.min.z],
      [targetBox.max.x, targetBox.max.y, targetBox.max.z],
      axis,
    );

    useScanStore
      .getState()
      .putAt(scanFractionFor((targetSpan.from + targetSpan.to) / 2, from, to));
    wantSection();
  }, [assistantScanRequest, sceneBounds, centersRevision, boxesRef]);

  useFrame((_, delta) => {
    if (isScanBandActive && sceneBounds && !sceneBounds.isEmpty()) {
      const gripState = useScanStore.getState();
      const currentAxis = sweepAxis(gripState.plane);
      setScanPlane(gripState.plane);

      const { from, to } = scanRangeAlong(
        [sceneBounds.min.x, sceneBounds.min.y, sceneBounds.min.z],
        [sceneBounds.max.x, sceneBounds.max.y, sceneBounds.max.z],
        currentAxis,
      );
      SCAN_TRAVEL_M.value = to - from;

      if (wasScannerGrabbed.current && !gripState.held) {
        firePulse();
        if (gripState.axial) {
          axialRequestCounter.current += 1;
          setAxialRunCount(axialRequestCounter.current);
        }
        if (gripState.sound) playScanPing();
      }
      wasScannerGrabbed.current = gripState.held;
      advanceScanPulse(delta);

      if (SECTION_WANTED.value !== lastObservedSectionWanted.current) {
        lastObservedSectionWanted.current = SECTION_WANTED.value;
        if (gripState.axial) {
          axialRequestCounter.current += 1;
          setAxialRunCount(axialRequestCounter.current);
        }
        timeSinceLastCrossing.current = CROSSING_INTERVAL_S;
      }

      if (scanIsStill(gripState)) {
        holdScanBand(gripState.at, currentAxis, from, to);
      } else {
        advanceScanBand(delta, currentAxis, from, to);
      }

      advanceScanEntry(delta);

      SWEEP_RUNNING.value = true;
      timeSinceLastCrossing.current += delta;
      if (timeSinceLastCrossing.current >= CROSSING_INTERVAL_S && boxesRef.current) {
        timeSinceLastCrossing.current = 0;
        const nextCrossing = crossingAt(boxesRef.current, SHARED_SCAN.value, currentAxis, CROSSING_LIMIT);
        if (!sameCrossing(nextCrossing, CURRENT_CROSSING.value)) {
          CURRENT_CROSSING.value = nextCrossing;
        }

        CURRENT_LEVEL.value =
          gripState.plane === "front"
            ? depthLabel(to - SHARED_SCAN.value)
            : levelAt(boxesRef.current, SHARED_SCAN.value);
      }
    } else if (SWEEP_RUNNING.value || CURRENT_CROSSING.value !== NOTHING_CROSSED) {
      SWEEP_RUNNING.value = false;
      CURRENT_CROSSING.value = NOTHING_CROSSED;
    }
  });

  return {
    axialRunCount,
    axialDetailSetting,
    activeScanPlane,
  };
}

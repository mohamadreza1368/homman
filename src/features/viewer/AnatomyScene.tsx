import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ScanRing } from "./ScanRing";
import { AxialProbe } from "./AxialProbe";
import { HeartbeatDriver } from "./HeartbeatDriver";
import { BreathDriver } from "./BreathDriver";
import { depthLabel, SECTION_VIEW, SECTION_WANTED, slicePlane, wantSection } from "./axialSlice";
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

import type { AnatomyManifest, SectionPlane } from "@/lib/schemas";
import {
  useSceneStore,
  type CrossSection,
} from "@/stores/sceneStore";
import { useChatStore } from "@/stores/chatStore";
import { scanIsStill, useScanStore } from "@/stores/scanStore";

import { lateralSign } from "./cameraViews";
import { explodeMembers, explodeOffsets } from "./explode";
import {
  collectSupply,
  isSystemMeasured,
  SUPPLY_SYSTEM,
} from "./supply";
import { PathwayFlow } from "./PathwayFlow";
import { StudioLights } from "./StudioLights";
import { ViewerSyncBridge } from "./ViewerSyncBridge";
import { CameraRig } from "./CameraRig";
import { SystemMeshes } from "./SystemMeshes";

/**
 * HOOMAAN Primary 3D Scene Engine.
 * Integrates glTF system mesh streaming, camera navigation rig with zoom-to-cursor,
 * dynamic multi-point studio illumination, animated physiological drivers,
 * tomographic sweeps, and hierarchical organ picking.
 */

const SECTION_PLANE_NORMALS: Record<SectionPlane, THREE.Vector3> = {
  sagittal: new THREE.Vector3(-1, 0, 0),
  coronal: new THREE.Vector3(0, 0, -1),
  axial: new THREE.Vector3(0, -1, 0),
};

function buildClippingPlanes(
  section: CrossSection | null,
  bounds: THREE.Box3 | null,
): THREE.Plane[] {
  if (!section) return [];
  const normalVec = SECTION_PLANE_NORMALS[section.plane].clone();

  let offsetConstant = section.position;
  if (bounds && !bounds.isEmpty()) {
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const axisKey: Record<SectionPlane, "x" | "y" | "z"> = {
      sagittal: "x",
      coronal: "z",
      axial: "y",
    };
    const k = axisKey[section.plane];
    offsetConstant = -(center[k] + (section.position * size[k]) / 2) * normalVec[k];
  }
  return [new THREE.Plane(normalVec, offsetConstant)];
}

export function AnatomyScene({
  manifest,
  onContextMenu,
}: {
  manifest: AnatomyManifest;
  onContextMenu: (organId: string, x: number, y: number) => void;
}) {
  const { gl } = useThree();
  const crossSection = useSceneStore((s) => s.crossSection);
  const focusRequest = useSceneStore((s) => s.focusRequest);
  const hiddenSystems = useSceneStore((s) => s.hiddenSystems);
  const pathway = useSceneStore((s) => s.pathway);
  const viewpoint = useSceneStore((s) => s.viewpoint);
  const explode = useSceneStore((s) => s.explode);
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const supplyRequest = useSceneStore((s) => s.supplyRequest);
  const resolveSupply = useSceneStore((s) => s.resolveSupply);
  const cancelSupply = useSceneStore((s) => s.cancelSupply);

  const meshFiles = useMemo(
    () =>
      [
        ...new Set(
          manifest.organs
            .filter((o) => !hiddenSystems.includes(o.system))
            .map((o) => o.mesh_file),
        ),
      ].sort(),
    [manifest.organs, hiddenSystems],
  );

  const centersRef = useRef(new Map<string, THREE.Vector3>());
  const boxesRef = useRef(new Map<string, THREE.Box3>());
  const [sceneBounds, setSceneBounds] = useState<THREE.Box3 | null>(null);

  const manualScanActive = useScanStore((s) => s.enabled);
  const isAnsweringPrompt = useChatStore((s) => s.pendingRequestId !== null);
  const sweepOnAnswer = useScanStore((s) => s.sweepOnAnswer);
  const isScanBandActive = manualScanActive || (isAnsweringPrompt && sweepOnAnswer);
  const timeSinceLastCrossing = useRef(0);

  const triggerScanView = useSceneStore((s) => s.scanView);
  useEffect(() => {
    resetScanBand();
    if (manualScanActive) triggerScanView();
  }, [manualScanActive, triggerScanView]);

  useEffect(() => {
    if (isScanBandActive) resetScanEntry();
  }, [isScanBandActive]);

  const activeTint = useScanStore((s) => s.tint);
  useEffect(() => setScanTint(scanTint(activeTint).light), [activeTint]);

  const isRevealMode = useScanStore((s) => s.reveal);
  useEffect(() => setScanReveal(isRevealMode), [isRevealMode]);

  const isGhostMode = useScanStore((s) => s.ghost);
  const axialDetailSetting = useScanStore((s) => s.detail);
  const activeScanPlane = useScanStore((s) => s.plane);
  useEffect(() => setScanGhost(isGhostMode), [isGhostMode]);

  const wasScannerGrabbed = useRef(false);
  const axialRequestCounter = useRef(0);
  const [axialRunCount, setAxialRunCount] = useState(0);
  const lastObservedSectionWanted = useRef(SECTION_WANTED.value);

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
      if (timeSinceLastCrossing.current >= CROSSING_INTERVAL_S) {
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

  const [finestDetailRadius, setFinestDetailRadius] = useState(0.01);
  const [centersRevision, setCentersRevision] = useState(0);

  const assistantScanRequest = useSceneStore((s) => s.scanRequest);
  const lastProcessedScanSeq = useRef(0);

  useEffect(() => {
    if (!assistantScanRequest || assistantScanRequest.seq === lastProcessedScanSeq.current) return;
    if (!sceneBounds || sceneBounds.isEmpty()) return;
    const targetBox = boxesRef.current.get(assistantScanRequest.organId);
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
  }, [assistantScanRequest, sceneBounds, centersRevision]);

  const handleMeasurements = useCallback(
    (
      newCenters: Map<string, THREE.Vector3>,
      newBoxes: Map<string, THREE.Box3>,
      box: THREE.Box3,
      finest: number,
    ) => {
      for (const [id, c] of newCenters) centersRef.current.set(id, c);
      for (const [id, b] of newBoxes) boxesRef.current.set(id, b);
      setSceneBounds((prev) => {
        const unioned = prev ? prev.clone() : new THREE.Box3();
        unioned.union(box);
        return unioned;
      });
      setFinestDetailRadius((prev) => Math.min(prev, finest));
      setCentersRevision((prev) => prev + 1);
    },
    [],
  );

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  const activeClippingPlanes = useMemo(
    () => buildClippingPlanes(crossSection, sceneBounds),
    [crossSection, sceneBounds],
  );

  const explodeOffsetMap = useMemo(
    () =>
      explodeOffsets(
        explodeMembers({ selectedOrganIds, isolatedOrganIds }, centersRef.current.keys()),
        centersRef.current,
        explode,
      ),
    [explode, selectedOrganIds, isolatedOrganIds, centersRevision],
  );

  useEffect(() => {
    if (!supplyRequest) return;
    if (isolatedOrganIds === null || isolatedOrganIds.length === 0) {
      cancelSupply();
      return;
    }

    const matchingOrganIds = manifest.organs
      .filter((o) => o.system === SUPPLY_SYSTEM[supplyRequest.kind])
      .map((o) => o.organ_id);

    if (matchingOrganIds.length === 0) {
      cancelSupply();
      return;
    }
    if (!isSystemMeasured(matchingOrganIds, boxesRef.current)) return;

    resolveSupply(collectSupply(isolatedOrganIds, matchingOrganIds, boxesRef.current));
  }, [
    supplyRequest,
    centersRevision,
    isolatedOrganIds,
    manifest.organs,
    resolveSupply,
    cancelSupply,
  ]);

  const lateralSignOrientation = useMemo(
    () => lateralSign(centersRef.current.keys(), centersRef.current),
    [centersRevision],
  );

  const modelDimensionScale = useMemo(() => {
    if (!sceneBounds || sceneBounds.isEmpty()) return 1;
    const sz = sceneBounds.getSize(new THREE.Vector3());
    return Math.max(sz.x, sz.y, sz.z, 1e-4);
  }, [sceneBounds]);

  return (
    <>
      <StudioLights />
      <ViewerSyncBridge
        centres={centersRef.current}
        offsets={explodeOffsetMap}
        geometryRevision={centersRevision}
      />

      {meshFiles.map((file) => (
        <SystemMeshes
          key={file}
          manifest={manifest}
          file={file}
          clippingPlanes={activeClippingPlanes}
          explodeOffsets={explodeOffsetMap}
          scanBandEnabled={isScanBandActive}
          onMeasured={handleMeasurements}
          onContextMenu={onContextMenu}
        />
      ))}

      {isScanBandActive && <ScanRing bounds={sceneBounds} instrument={manualScanActive} />}
      {isScanBandActive && (
        <AxialProbe
          bounds={sceneBounds}
          request={axialRunCount}
          high={axialDetailSetting}
          leftSign={lateralSignOrientation}
          plane={slicePlane(activeScanPlane)}
        />
      )}

      <HeartbeatDriver
        boxes={boxesRef.current}
        organs={manifest.organs}
        revision={centersRevision}
      />
      <BreathDriver
        boxes={boxesRef.current}
        bounds={sceneBounds}
        revision={centersRevision}
      />

      {pathway && (
        <PathwayFlow
          pathway={pathway}
          centres={centersRef.current}
          centresRevision={centersRevision}
          modelScale={modelDimensionScale}
        />
      )}

      <CameraRig
        focusRequest={focusRequest}
        viewpoint={viewpoint}
        centres={centersRef.current}
        offsets={explodeOffsetMap}
        boxes={boxesRef}
        isolatedOrganIds={isolatedOrganIds}
        leftSign={lateralSignOrientation}
        bounds={sceneBounds}
        finestDetail={finestDetailRadius}
      />
    </>
  );
}

/**
 * HOOMAAN Primary 3D Scene Viewport
 * Declarative 3D Canvas composition orchestrating glTF organ streaming,
 * dynamic multi-source studio lighting, camera navigation, physiological drivers,
 * and real-time tomographic scanning.
 */

import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { ScanRing } from "./ScanRing";
import { AxialProbe } from "./AxialProbe";
import { HeartbeatDriver } from "./HeartbeatDriver";
import { BreathDriver } from "./BreathDriver";
import { CardiacConductionLayer } from "./CardiacConductionLayer";
import { ClinicalProceduresOverlay } from "./ClinicalProceduresOverlay";
import { SurfaceLandmarksLayer } from "./SurfaceLandmarksLayer";
import { slicePlane } from "./axialSlice";

import type { AnatomyManifest } from "@/lib/schemas";
import { useSceneStore } from "@/stores/sceneStore";
import { useChatStore } from "@/stores/chatStore";
import { useScanStore } from "@/stores/scanStore";

import { lateralSign } from "./cameraViews";
import { explodeMembers, explodeOffsets } from "./explode";
import { PathwayFlow } from "./PathwayFlow";
import { StudioLights } from "./StudioLights";
import { ViewerSyncBridge } from "./ViewerSyncBridge";
import { CameraRig } from "./CameraRig";
import { SystemMeshes } from "./SystemMeshes";

import { useTomographicSweep } from "./useTomographicSweep";
import { useClippingSection } from "./useClippingSection";
import { useVascularSupplyResolver } from "./useVascularSupplyResolver";

export interface AnatomySceneProps {
  manifest: AnatomyManifest;
  onContextMenu: (organId: string, clientX: number, clientY: number) => void;
}

export function AnatomyScene({ manifest, onContextMenu }: AnatomySceneProps) {
  const { gl } = useThree();

  const crossSection = useSceneStore((s) => s.crossSection);
  const focusRequest = useSceneStore((s) => s.focusRequest);
  const hiddenSystems = useSceneStore((s) => s.hiddenSystems);
  const pathway = useSceneStore((s) => s.pathway);
  const viewpoint = useSceneStore((s) => s.viewpoint);
  const explode = useSceneStore((s) => s.explode);
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);

  const manualScanActive = useScanStore((s) => s.enabled);
  const isAnsweringPrompt = useChatStore((s) => s.pendingRequestId !== null);
  const sweepOnAnswer = useScanStore((s) => s.sweepOnAnswer);
  const isScanBandActive = manualScanActive || (isAnsweringPrompt && sweepOnAnswer);

  const centersRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const boxesRef = useRef<Map<string, THREE.Box3>>(new Map());
  const [sceneBounds, setSceneBounds] = useState<THREE.Box3 | null>(null);
  const [finestDetailRadius, setFinestDetailRadius] = useState(0.01);
  const [centersRevision, setCentersRevision] = useState(0);

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  const activeClippingPlanes = useClippingSection(crossSection, sceneBounds);

  const { axialRunCount, axialDetailSetting, activeScanPlane } = useTomographicSweep(
    isScanBandActive,
    manualScanActive,
    sceneBounds,
    boxesRef,
    centersRevision,
  );

  useVascularSupplyResolver(manifest, boxesRef, centersRevision);

  const activeMeshFiles = useMemo(() => {
    const files = new Set<string>();
    for (const item of manifest.organs) {
      if (!hiddenSystems.includes(item.system)) {
        files.add(item.mesh_file);
      }
    }
    return Array.from(files).sort();
  }, [manifest.organs, hiddenSystems]);

  const handleMeshMeasurements = useCallback(
    (
      newCenters: Map<string, THREE.Vector3>,
      newBoxes: Map<string, THREE.Box3>,
      groupBoundingBox: THREE.Box3,
      finestSize: number,
    ) => {
      for (const [id, vec] of newCenters) centersRef.current.set(id, vec);
      for (const [id, box] of newBoxes) boxesRef.current.set(id, box);

      setSceneBounds((current) => {
        const nextBounds = current ? current.clone() : new THREE.Box3();
        nextBounds.union(groupBoundingBox);
        return nextBounds;
      });

      setFinestDetailRadius((prev) => Math.min(prev, finestSize));
      setCentersRevision((v) => v + 1);
    },
    [],
  );

  const explodeOffsetMap = useMemo(() => {
    const participantIds = explodeMembers(
      { selectedOrganIds, isolatedOrganIds },
      centersRef.current.keys(),
    );
    return explodeOffsets(participantIds, centersRef.current, explode);
  }, [explode, selectedOrganIds, isolatedOrganIds, centersRevision]);

  const lateralSignOrientation = useMemo(
    () => lateralSign(centersRef.current.keys(), centersRef.current),
    [centersRevision],
  );

  const modelDimensionScale = useMemo(() => {
    if (!sceneBounds || sceneBounds.isEmpty()) return 1;
    const size = sceneBounds.getSize(new THREE.Vector3());
    return Math.max(size.x, size.y, size.z, 1e-4);
  }, [sceneBounds]);

  return (
    <>
      <StudioLights />
      <ViewerSyncBridge
        centres={centersRef.current}
        offsets={explodeOffsetMap}
        geometryRevision={centersRevision}
      />

      {activeMeshFiles.map((filename) => (
        <SystemMeshes
          key={filename}
          manifest={manifest}
          file={filename}
          clippingPlanes={activeClippingPlanes}
          explodeOffsets={explodeOffsetMap}
          scanBandEnabled={isScanBandActive}
          onMeasured={handleMeshMeasurements}
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
      <CardiacConductionLayer centres={centersRef.current} />
      <ClinicalProceduresOverlay centres={centersRef.current} />
      <SurfaceLandmarksLayer boxes={boxesRef.current} revision={centersRevision} />

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

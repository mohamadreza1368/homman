import { OrbitControls, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

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

import { meshUrl, organsInFile } from "@/lib/manifest";
import type { AnatomyManifest, ManifestOrgan, SectionPlane } from "@/lib/schemas";
import {
  isOrganVisible,
  organOpacity,
  useSceneStore,
  type CrossSection,
  type FocusRequest,
  type ViewpointRequest,
} from "@/stores/sceneStore";
import { useChatStore } from "@/stores/chatStore";
import { scanIsStill, useScanStore } from "@/stores/scanStore";
import { useStudyStore } from "@/stores/studyStore";

import { illuminationGlow } from "./depthStack";
import { buildEyeGroups } from "./eyes";
import { EyeGlobe } from "./EyeGlobe";
import { backgroundTheme } from "./background";
import { framingDistance, lateralSign, scanStance, viewDirection } from "./cameraViews";
import { busiestTouches } from "./coverage";
import { explodeMembers, explodeOffsets } from "./explode";
import {
  STUDIO_AMBIENT,
  STUDIO_FILL,
  STUDIO_KEY,
  STUDIO_RIM,
  studioLightDirections,
  LIGHTING_PRESETS,
} from "./lighting";
import { keepsColour } from "./scan";
import {
  collectSupply,
  isSystemMeasured,
  studyEnvelope,
  SUPPLY_SYSTEM,
} from "./supply";
import { useExplodeMotion } from "./useExplodeMotion";
import { setViewerHandle } from "./viewerBridge";
import { OrganMesh } from "./OrganMesh";
import { PathwayFlow } from "./PathwayFlow";

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

const DRACO_DECODER_LOCAL_PATH = "/draco/";

interface OrganGeometry {
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
}

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

function ViewerBridge({
  centres,
  offsets,
  geometryRevision,
}: {
  centres: Map<string, THREE.Vector3>;
  offsets: Map<string, THREE.Vector3>;
  geometryRevision: number;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null;

  useEffect(() => {
    setViewerHandle({ gl, scene, camera, centres, offsets, controls, geometryRevision });
    return () => setViewerHandle(null);
  }, [gl, scene, camera, centres, offsets, controls, geometryRevision]);

  return null;
}

function StudioLights() {
  const background = useSceneStore((s) => s.background);
  const lightingPreset = useSceneStore((s) => s.lightingPreset ?? "studio");
  const preset = LIGHTING_PRESETS[lightingPreset] ?? LIGHTING_PRESETS.studio;

  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);

  const forwardVec = useRef(new THREE.Vector3());
  const lightDirs = useRef(
    studioLightDirections(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)),
  );

  useFrame(({ camera }) => {
    camera.getWorldDirection(forwardVec.current);
    const aimed = studioLightDirections(forwardVec.current, camera.up, lightDirs.current);
    keyLightRef.current?.position.copy(aimed.key).multiplyScalar(10);
    fillLightRef.current?.position.copy(aimed.fill).multiplyScalar(10);
    rimLightRef.current?.position.copy(aimed.rim).multiplyScalar(10);
  });

  return (
    <>
      <ambientLight
        name={STUDIO_AMBIENT}
        intensity={backgroundTheme(background).ambient * preset.ambientMultiplier}
      />
      <directionalLight name={STUDIO_KEY} ref={keyLightRef} intensity={preset.keyIntensity} />
      <directionalLight
        name={STUDIO_FILL}
        ref={fillLightRef}
        intensity={preset.fillIntensity}
        color={preset.fillColor}
      />
      <directionalLight
        name={STUDIO_RIM}
        ref={rimLightRef}
        intensity={preset.rimIntensity}
        color={preset.rimColor}
      />
      <directionalLight
        position={[0, -5, 1]}
        intensity={preset.bounceIntensity}
        color={preset.bounceColor}
      />
    </>
  );
}

function CameraRig({
  focusRequest,
  viewpoint,
  centres,
  offsets,
  boxes,
  isolatedOrganIds,
  leftSign,
  bounds,
  finestDetail,
}: {
  focusRequest: FocusRequest | null;
  viewpoint: ViewpointRequest | null;
  centres: Map<string, THREE.Vector3>;
  offsets: Map<string, THREE.Vector3>;
  boxes: React.RefObject<Map<string, THREE.Box3>>;
  isolatedOrganIds: string[] | null;
  leftSign: 1 | -1;
  bounds: THREE.Box3 | null;
  finestDetail: number;
}) {
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

function SystemMeshes({
  manifest,
  file,
  clippingPlanes,
  explodeOffsets: offsets,
  scanBandEnabled,
  onMeasured,
  onContextMenu,
}: {
  manifest: AnatomyManifest;
  file: string;
  clippingPlanes: THREE.Plane[];
  explodeOffsets: Map<string, THREE.Vector3>;
  scanBandEnabled: boolean;
  onMeasured: (
    centres: Map<string, THREE.Vector3>,
    boxes: Map<string, THREE.Box3>,
    bounds: THREE.Box3,
    finestDetail: number,
  ) => void;
  onContextMenu: (organId: string, x: number, y: number) => void;
}) {
  const { nodes } = useGLTF(meshUrl(file), DRACO_DECODER_LOCAL_PATH);
  const registerMeshExplode = useExplodeMotion(offsets);

  const fileOrgans = useMemo(() => organsInFile(manifest, file), [manifest, file]);

  const hoveredOrganId = useSceneStore((s) => s.hoveredOrganId);
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);
  const hiddenOrganIds = useSceneStore((s) => s.hiddenOrganIds);
  const hideConnective = useSceneStore((s) => s.hideConnective);
  const connectiveIds = useSceneStore((s) => s.connectiveIds);
  const pathologyOverlays = useSceneStore((s) => s.pathologyOverlays);
  const caseMarks = useSceneStore((s) => s.caseMarks);
  const hiddenSystems = useSceneStore((s) => s.hiddenSystems);
  const systemOpacity = useSceneStore((s) => s.systemOpacity);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const setHovered = useSceneStore((s) => s.setHovered);
  const selectOrgan = useSceneStore((s) => s.selectFromViewport);
  const studyOrgan = useSceneStore((s) => s.studyOrgan);
  const studyRegion = useSceneStore((s) => s.studyRegion);
  const setDepthStack = useSceneStore((s) => s.setDepthStack);
  const eyeTracking = useSceneStore((s) => s.eyeTracking);

  const onStudy = useCallback(
    (organId: string, additive: boolean) =>
      additive ? studyOrgan(organId, true) : studyRegion(organId),
    [studyOrgan, studyRegion],
  );

  const depthStack = useSceneStore((s) => s.depthStack);
  const illuminated = useSceneStore((s) => s.illuminated);
  const bodyTone = useSceneStore((s) => s.bodyTone);

  const litGlowMap = useMemo(
    () =>
      new Map(
        illuminated.map((id, index) => [id, illuminationGlow(index, illuminated.length)]),
      ),
    [illuminated],
  );

  const probeDepthMap = useMemo(
    () =>
      illuminated.length > 0
        ? new Map<string, number>()
        : new Map(depthStack.map((id, index) => [id, index])),
    [illuminated, depthStack],
  );

  const coverageVisible = useStudyStore((s) => s.coverageVisible);
  const coverageCounts = useStudyStore((s) => s.coverage);
  const coverageData = useMemo(
    () =>
      coverageVisible
        ? { byOrgan: coverageCounts, busiest: busiestTouches(coverageCounts) }
        : null,
    [coverageVisible, coverageCounts],
  );

  const parsedGeometries = useMemo(() => {
    const result = new Map<string, OrganGeometry>();
    const missingNodes: string[] = [];

    for (const organ of fileOrgans) {
      const gltfNode =
        nodes[organ.node] ?? nodes[THREE.PropertyBinding.sanitizeNodeName(organ.node)];
      if (gltfNode instanceof THREE.Mesh) {
        gltfNode.updateWorldMatrix(true, false);
        result.set(organ.organ_id, {
          geometry: gltfNode.geometry as THREE.BufferGeometry,
          matrix: gltfNode.matrixWorld.clone(),
        });
      } else {
        missingNodes.push(organ.node);
      }
    }

    if (missingNodes.length > 0) {
      console.error(
        `[HOOMAAN Viewer] Missing mesh nodes in ${file}: ${missingNodes.join(", ")}`,
      );
    }
    return result;
  }, [nodes, fileOrgans, file]);

  const geometryMetrics = useMemo(() => {
    const organCenters = new Map<string, THREE.Vector3>();
    const organBoxes = new Map<string, THREE.Box3>();
    const combinedBounds = new THREE.Box3();
    let minDimension = Number.POSITIVE_INFINITY;

    for (const [id, item] of parsedGeometries) {
      if (!item.geometry.boundingBox) item.geometry.computeBoundingBox();
      const localBox = item.geometry.boundingBox;
      if (!localBox) continue;

      const worldBox = localBox.clone().applyMatrix4(item.matrix);
      organCenters.set(id, worldBox.getCenter(new THREE.Vector3()));
      organBoxes.set(id, worldBox);
      combinedBounds.union(worldBox);

      const sz = worldBox.getSize(new THREE.Vector3());
      const maxSpan = Math.max(sz.x, sz.y, sz.z);
      if (maxSpan > 1e-6) minDimension = Math.min(minDimension, maxSpan * 0.5);
    }
    return {
      centres: organCenters,
      boxes: organBoxes,
      bounds: combinedBounds,
      finest: Number.isFinite(minDimension) ? minDimension : 0.01,
    };
  }, [parsedGeometries]);

  useEffect(() => {
    onMeasured(
      geometryMetrics.centres,
      geometryMetrics.boxes,
      geometryMetrics.bounds,
      geometryMetrics.finest,
    );
  }, [geometryMetrics, onMeasured]);

  const eyeGroups = useMemo(
    () => buildEyeGroups(fileOrgans, geometryMetrics.centres),
    [fileOrgans, geometryMetrics],
  );
  const eyeOrganIdSet = useMemo(
    () => new Set(eyeGroups.flatMap((eye) => eye.organs.map((o) => o.organ_id))),
    [eyeGroups],
  );

  const localEyeMatrices = useMemo(() => {
    const transformMap = new Map<string, THREE.Matrix4>();
    for (const eye of eyeGroups) {
      const inverseTranslate = new THREE.Matrix4().makeTranslation(
        -eye.centre.x,
        -eye.centre.y,
        -eye.centre.z,
      );
      for (const o of eye.organs) {
        const item = parsedGeometries.get(o.organ_id);
        if (!item) continue;
        transformMap.set(
          o.organ_id,
          new THREE.Matrix4().multiplyMatrices(inverseTranslate, item.matrix),
        );
      }
    }
    return transformMap;
  }, [eyeGroups, parsedGeometries]);

  const renderSingleOrgan = (organ: ManifestOrgan, explicitMatrix?: THREE.Matrix4) => {
    const entry = parsedGeometries.get(organ.organ_id);
    if (!entry) return null;

    return (
      <OrganMesh
        key={organ.organ_id}
        scanBandEnabled={scanBandEnabled}
        worldBox={geometryMetrics.boxes.get(organ.organ_id)}
        organ={organ}
        geometry={entry.geometry}
        matrix={explicitMatrix ?? entry.matrix}
        visible={isOrganVisible(
          { hiddenSystems, isolatedOrganIds, hiddenOrganIds, hideConnective, connectiveIds },
          organ,
        )}
        opacity={organOpacity({ systemOpacity }, organ)}
        hovered={hoveredOrganId === organ.organ_id}
        selected={selectedOrganIds.includes(organ.organ_id)}
        overlay={pathologyOverlays[organ.organ_id] ?? caseMarks[organ.organ_id]}
        coverageTouches={
          coverageData ? coverageData.byOrgan[organ.organ_id] ?? 0 : undefined
        }
        coverageBusiest={coverageData?.busiest}
        probeDepth={probeDepthMap.get(organ.organ_id)}
        litGlow={litGlowMap.get(organ.organ_id)}
        tone={
          keepsColour({
            lit: litGlowMap.has(organ.organ_id),
            selected: selectedOrganIds.includes(organ.organ_id),
            isolated: isolatedOrganIds?.includes(organ.organ_id) ?? false,
          })
            ? "solid"
            : bodyTone
        }
        clippingPlanes={clippingPlanes}
        onHover={setHovered}
        onSelect={selectOrgan}
        onProbe={setDepthStack}
        onContextMenu={onContextMenu}
        onRegister={registerMeshExplode}
        onStudy={onStudy}
      />
    );
  };

  return (
    <group>
      {eyeGroups.map((eye) => (
        <EyeGlobe key={eye.side} eye={eye} enabled={eyeTracking}>
          {eye.organs.map((organ) => {
            const m = localEyeMatrices.get(organ.organ_id);
            return m ? renderSingleOrgan(organ, m) : null;
          })}
        </EyeGlobe>
      ))}

      {fileOrgans.map((organ) =>
        eyeOrganIdSet.has(organ.organ_id) ? null : renderSingleOrgan(organ),
      )}
    </group>
  );
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
      <ViewerBridge
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

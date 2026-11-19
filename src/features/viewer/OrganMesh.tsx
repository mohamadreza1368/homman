import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { GHOST_CLICK_THROUGH, type PathologyOverlay } from "@/stores/sceneStore";
import { reportClick } from "./depthStack";
import { pressTravelled } from "./dragGuard";
import { shouldSuppressClick } from "./areaSelect";
import { coverageColour } from "./coverage";
import { registerCarry } from "./breathCarry";
import { BREATH_ROLE, breathData, breathOnBeforeCompile } from "./breathing";
import { scanColour, type BodyTone } from "./scan";
import { FACING, scanBandMaterialProps, scanRangeAlong, STANDING } from "./scanBand";
import {
  beatChamber,
  heartbeatOnBeforeCompile,
  isAtrium,
  isChamberWall,
  registerBeating,
} from "./heartbeat";
import { flowMaterial, isFlowSeed, registerFlowing, vesselFlow } from "./bloodFlow";
import { useHeartStore } from "@/stores/heartStore";
import { probeGlow, reportDepthStack, stackFromCrossings } from "./depthStack";
import type { ManifestOrgan } from "@/lib/schemas";
import {
  tissueColour,
  tissueDepthBias,
  tissueMetalness,
  tissueOpacity,
  tissueRoughness,
} from "./palette";

/**
 * HOOMAAN Anatomical Organ Mesh Component.
 * High-performance memoized mesh node rendering individual anatomical structures.
 * Integrates dynamic tissue palettes, respiratory and cardiac shader compilation,
 * vessel haemodynamic illumination, occlusion silhouettes, and raycasted probe hits.
 */

const AMBER = new THREE.Color("#e8a33d");
const CRIMSON = new THREE.Color("#c62828");
const SELECTED = new THREE.Color("#00a8e8");
const PROBE_LIGHT = new THREE.Color("#ffe8c4");
const LIT_LIGHT = new THREE.Color("#35e07a");

const LIT_FLOOR = 0.22;
const LIT_RANGE = 0.75;
const OCCLUDED_FLOOR = 0.16;
const OCCLUDED_RANGE = 0.34;
const LIT_MIN_OPACITY = 0.92;
const SELECTED_MIN_OPACITY = 0.55;

const NO_RAYCAST = () => null;
const DEFAULT_RAYCAST = THREE.Mesh.prototype.raycast;

function pathologyColour(tissue: THREE.Color, severity: number): THREE.Color {
  const clamped = Math.min(Math.max(severity, 0), 1);
  return clamped <= 0.5
    ? tissue.clone().lerp(AMBER, clamped * 2)
    : AMBER.clone().lerp(CRIMSON, (clamped - 0.5) * 2);
}

interface OrganMeshProps {
  organ: ManifestOrgan;
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  visible: boolean;
  opacity: number;
  hovered: boolean;
  selected: boolean;
  overlay: PathologyOverlay | undefined;
  coverageTouches: number | undefined;
  coverageBusiest: number | undefined;
  probeDepth: number | undefined;
  litGlow: number | undefined;
  tone: BodyTone;
  scanBandEnabled?: boolean;
  worldBox?: THREE.Box3 | undefined;
  clippingPlanes: THREE.Plane[];
  onHover: (organId: string | null) => void;
  onSelect: (organId: string, additive: boolean) => void;
  onStudy: (organId: string, additive: boolean) => void;
  onProbe: (organIds: string[]) => void;
  onContextMenu: (organId: string, x: number, y: number) => void;
  onRegister?: (organId: string, mesh: THREE.Mesh | null, base: THREE.Matrix4) => void;
}

export const OrganMesh = memo(function OrganMesh({
  organ,
  geometry,
  matrix,
  visible,
  opacity: layerOpacity,
  hovered,
  selected,
  overlay,
  coverageTouches,
  coverageBusiest,
  probeDepth,
  litGlow: litGlowProp,
  tone,
  scanBandEnabled = false,
  worldBox,
  clippingPlanes,
  onHover,
  onSelect,
  onStudy,
  onProbe,
  onContextMenu,
  onRegister,
}: OrganMeshProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const registerCallback = useCallback(
    (mesh: THREE.Mesh | null) => {
      meshRef.current = mesh;
      onRegister?.(organ.organ_id, mesh, matrix);
    },
    [onRegister, organ.organ_id, matrix],
  );

  const userData = useMemo(() => ({ organId: organ.organ_id }), [organ.organ_id]);
  const litGlow = litGlowProp ?? 0;

  const opacity = Math.max(
    layerOpacity * tissueOpacity(organ),
    litGlow > 0 ? LIT_MIN_OPACITY : 0,
    selected ? SELECTED_MIN_OPACITY : 0,
  );
  const clickThrough = opacity < GHOST_CLICK_THROUGH;
  const ghosted = opacity < 1;
  const depthBias = tissueDepthBias(organ);

  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const scanMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const beatMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    if (materialRef.current) materialRef.current.needsUpdate = true;
    if (scanMaterialRef.current) scanMaterialRef.current.needsUpdate = true;
    if (beatMaterialRef.current) beatMaterialRef.current.needsUpdate = true;
  }, [ghosted]);

  const chamber = useMemo(() => beatChamber(organ), [organ]);
  const breath = useMemo(
    () => breathData(organ, worldBox, chamber !== null),
    [organ, worldBox, chamber],
  );

  const carryPart = useMemo(() => {
    if (breath.breathRole === BREATH_ROLE.viscera) return "carrier" as const;
    if (breath.breathRole === BREATH_ROLE.heart) return "heart" as const;
    if (breath.breathRole !== BREATH_ROLE.vessel) return null;
    const lowerName = organ.name_en.toLowerCase();
    if (lowerName.includes("aorta")) return "anchor" as const;
    return lowerName.includes("vena cava") ? ("vena cava" as const) : ("vessel" as const);
  }, [breath, organ.name_en]);

  useEffect(() => {
    const meshNode = meshRef.current;
    if (!meshNode || carryPart === null) return;
    return registerCarry(organ.organ_id, { mesh: meshNode, part: carryPart });
  }, [carryPart, organ.organ_id]);

  const isBeatingActive = useHeartStore((s) => chamber !== null && s.enabled);
  const beatUserData = useMemo(() => {
    if (chamber === null) return null;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const ctr = geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
    return {
      ...breath,
      organId: organ.organ_id,
      beatAtrium: isAtrium(chamber) ? 1 : 0,
      beatLeft: chamber.startsWith("left") ? 1 : 0,
      beatCentre: { value: ctr },
    };
  }, [chamber, geometry, organ.organ_id, breath]);

  useEffect(() => {
    const meshNode = meshRef.current;
    if (!isBeatingActive || !meshNode || chamber === null || !beatUserData) return;
    return registerBeating(organ.organ_id, {
      mesh: meshNode,
      chamber,
      wall: isChamberWall(organ),
      centre: beatUserData.beatCentre,
    });
  }, [isBeatingActive, chamber, beatUserData, organ]);

  const flowKind = useMemo(() => vesselFlow(organ), [organ]);
  const isFlowEnabled = useHeartStore((s) => flowKind !== null && s.enabled);
  const isFlowing = isFlowEnabled && visible && layerOpacity < 1;
  const flowMat = isFlowing && flowKind ? flowMaterial(flowKind) : null;

  useEffect(() => {
    if (flowMat) flowMat.clippingPlanes = clippingPlanes;
  }, [flowMat, clippingPlanes]);

  useEffect(() => {
    const meshNode = meshRef.current;
    if (!isFlowing || !meshNode || flowKind === null) return;
    return registerFlowing(organ.organ_id, {
      mesh: meshNode,
      kind: flowKind,
      seed: isFlowSeed(flowKind, organ),
    });
  }, [isFlowing, flowKind, organ]);

  const { color, emissive, emissiveIntensity } = useMemo(() => {
    const baseTissue =
      coverageTouches !== undefined && coverageBusiest !== undefined
        ? coverageColour(coverageTouches, coverageBusiest)
        : scanColour(tissueColour(organ), tone);
    const resolvedBase = overlay ? pathologyColour(baseTissue, overlay.severity) : baseTissue;

    if (overlay) {
      return {
        color: resolvedBase,
        emissive: resolvedBase,
        emissiveIntensity: 0.15 + overlay.severity * 0.35,
      };
    }
    if (litGlow > 0) {
      return {
        color: resolvedBase.clone().lerp(LIT_LIGHT, 0.45),
        emissive: LIT_LIGHT,
        emissiveIntensity: LIT_FLOOR + litGlow * LIT_RANGE,
      };
    }
    if (selected) {
      return {
        color: resolvedBase.clone().lerp(SELECTED, 0.5),
        emissive: SELECTED,
        emissiveIntensity: 0.14,
      };
    }
    if (hovered) {
      return {
        color: resolvedBase.clone().lerp(SELECTED, 0.24),
        emissive: SELECTED,
        emissiveIntensity: 0.07,
      };
    }
    if (probeDepth !== undefined) {
      const g = probeGlow(probeDepth);
      if (g > 0) {
        return {
          color: resolvedBase,
          emissive: PROBE_LIGHT,
          emissiveIntensity: 0.08 + g * 0.5,
        };
      }
    }
    return { color: resolvedBase, emissive: baseTissue, emissiveIntensity: 0 };
  }, [
    organ,
    hovered,
    selected,
    overlay,
    coverageTouches,
    coverageBusiest,
    probeDepth,
    litGlow,
    tone,
  ]);

  const scanSpan = useMemo((): readonly [number, number] | undefined => {
    if (!scanBandEnabled || !worldBox) return undefined;
    const { from, to } = scanRangeAlong(
      [worldBox.min.x, worldBox.min.y, worldBox.min.z],
      [worldBox.max.x, worldBox.max.y, worldBox.max.z],
      STANDING,
    );
    return [from, to];
  }, [scanBandEnabled, worldBox]);

  const scanSpanFront = useMemo((): readonly [number, number] | undefined => {
    if (!scanBandEnabled || !worldBox) return undefined;
    const { from, to } = scanRangeAlong(
      [worldBox.min.x, worldBox.min.y, worldBox.min.z],
      [worldBox.max.x, worldBox.max.y, worldBox.max.z],
      FACING,
    );
    return [from, to];
  }, [scanBandEnabled, worldBox]);

  const revealColour = useMemo((): readonly [number, number, number] | undefined => {
    if (!scanBandEnabled) return undefined;
    const baseColor =
      coverageTouches !== undefined && coverageBusiest !== undefined
        ? coverageColour(coverageTouches, coverageBusiest)
        : tissueColour(organ);
    const visibleCol = overlay ? pathologyColour(baseColor, overlay.severity) : baseColor;
    return [visibleCol.r, visibleCol.g, visibleCol.b];
  }, [scanBandEnabled, organ, overlay, coverageTouches, coverageBusiest]);

  const scanProps = useMemo(() => {
    if (!scanBandEnabled) return null;
    const props = scanBandMaterialProps(true, scanSpan, revealColour, scanSpanFront);
    const own = (props as { userData?: object }).userData;
    return { ...props, userData: { ...own, ...breath } };
  }, [scanBandEnabled, scanSpan, revealColour, scanSpanFront, breath]);

  const surfaceProps = {
    color,
    emissive,
    emissiveIntensity,
    roughness: tissueRoughness(organ.system),
    metalness: tissueMetalness(organ.system),
    transparent: ghosted,
    opacity,
    depthWrite: !ghosted,
    polygonOffset: depthBias !== 0,
    polygonOffsetFactor: depthBias,
    polygonOffsetUnits: depthBias,
    clippingPlanes,
    side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide,
  };

  return (
    <mesh
      ref={registerCallback}
      geometry={geometry}
      matrix={matrix}
      matrixAutoUpdate={false}
      visible={visible}
      userData={userData}
      raycast={visible ? DEFAULT_RAYCAST : NO_RAYCAST}
      onPointerMove={(e) => {
        e.stopPropagation();
        reportDepthStack();
        onProbe(stackFromCrossings(e.intersections));
      }}
      onPointerOver={(e) => {
        if (clickThrough) return;
        e.stopPropagation();
        onHover(organ.organ_id);
      }}
      onPointerOut={(e) => {
        if (clickThrough) return;
        e.stopPropagation();
        onHover(null);
      }}
      onClick={(e) => {
        if (clickThrough) return;
        e.stopPropagation();
        if (shouldSuppressClick()) return;
        if (pressTravelled()) return;
        reportClick();
        onSelect(organ.organ_id, e.ctrlKey || e.metaKey);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        onContextMenu(organ.organ_id, e.clientX, e.clientY);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;
        onStudy(organ.organ_id, isAdditive);
      }}
    >
      <meshStandardMaterial
        ref={materialRef}
        {...surfaceProps}
        onBeforeCompile={breathOnBeforeCompile}
        userData={breath}
      />

      {scanBandEnabled && (
        <meshStandardMaterial
          ref={scanMaterialRef}
          {...surfaceProps}
          {...scanProps}
        />
      )}

      {isBeatingActive && beatUserData && (
        <meshStandardMaterial
          key={scanBandEnabled ? "beat-over-scan" : "beat"}
          ref={beatMaterialRef}
          {...surfaceProps}
          onBeforeCompile={heartbeatOnBeforeCompile}
          userData={beatUserData}
        />
      )}

      {flowMat && (
        <mesh
          geometry={geometry}
          material={flowMat}
          raycast={NO_RAYCAST}
          renderOrder={3}
        />
      )}

      {litGlow > 0 && (
        <mesh
          geometry={geometry}
          raycast={NO_RAYCAST}
          renderOrder={4}
        >
          <meshBasicMaterial
            onBeforeCompile={breathOnBeforeCompile}
            userData={breath}
            color={LIT_LIGHT}
            transparent
            opacity={OCCLUDED_FLOOR + litGlow * OCCLUDED_RANGE}
            depthFunc={THREE.GreaterDepth}
            depthWrite={false}
            toneMapped={false}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      )}
    </mesh>
  );
});

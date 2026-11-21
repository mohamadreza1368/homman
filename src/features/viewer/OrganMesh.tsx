import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

import type { ManifestOrgan } from "@/lib/schemas";
import { GHOST_CLICK_THROUGH, type PathologyOverlay } from "@/stores/sceneStore";
import { useHeartStore } from "@/stores/heartStore";

import { pressTravelled } from "./dragGuard";
import { reportClick } from "./depthStack";
import { shouldSuppressClick } from "./areaSelect";
import { coverageColour } from "./coverage";
import { registerCarry } from "./breathCarry";
import { BREATH_ROLE, breathData, breathOnBeforeCompile } from "./breathing";
import { type BodyTone } from "./scan";
import {
  beatChamber,
  heartbeatOnBeforeCompile,
  isAtrium,
  isChamberWall,
  registerBeating,
} from "./heartbeat";
import { flowMaterial, isFlowSeed, registerFlowing, vesselFlow } from "./bloodFlow";
import {
  tissueColour,
  tissueDepthBias,
  tissueMetalness,
  tissueOpacity,
  tissueRoughness,
} from "./palette";

export interface OrganMeshProps {
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

// Clean-Room Visual Constants
const ACCENT_SELECT = new THREE.Color("#00a8e8");
const WARN_PATHOLOGY = new THREE.Color("#e8a33d");
const CRIT_PATHOLOGY = new THREE.Color("#c62828");
const GLOW_LIT = new THREE.Color("#35e07a");
const DEPTH_PROBE = new THREE.Color("#ffe8c4");

/**
 * Calculates blended surface diffuse color considering base tissue, pathology,
 * active selection highlights, and spatial study coverage.
 */
function resolveSurfaceTint(
  organ: ManifestOrgan,
  _tone: BodyTone,
  selected: boolean,
  hovered: boolean,
  overlay: PathologyOverlay | undefined,
  probeDepth: number | undefined,
  litGlow: number | undefined,
  coverageTouches: number | undefined,
  coverageBusiest: number | undefined,
): THREE.Color {
  const base = tissueColour(organ).clone();

  if (overlay) {
    const sev = Math.min(Math.max(overlay.severity, 0), 1);
    const pathologyTint =
      sev <= 0.5
        ? base.clone().lerp(WARN_PATHOLOGY, sev * 2)
        : WARN_PATHOLOGY.clone().lerp(CRIT_PATHOLOGY, (sev - 0.5) * 2);
    base.copy(pathologyTint);
  }

  if (coverageTouches !== undefined && coverageBusiest !== undefined && coverageBusiest > 0) {
    const heatColor = coverageColour(coverageTouches, coverageBusiest);
    base.lerp(heatColor, 0.65);
  }

  if (selected) {
    base.lerp(ACCENT_SELECT, 0.7);
  } else if (hovered) {
    base.offsetHSL(0, 0.05, 0.15);
  }

  if (litGlow !== undefined && litGlow > 0) {
    base.lerp(GLOW_LIT, Math.min(litGlow, 1) * 0.8);
  } else if (probeDepth !== undefined) {
    base.lerp(DEPTH_PROBE, Math.max(0.2, 1 - probeDepth * 0.15));
  }

  return base;
}

export const OrganMesh = memo(function OrganMesh({
  organ,
  geometry,
  matrix,
  visible,
  opacity,
  hovered,
  selected,
  overlay,
  coverageTouches,
  coverageBusiest,
  probeDepth,
  litGlow,
  tone,
  worldBox,
  clippingPlanes,
  onHover,
  onSelect,
  onStudy,
  onContextMenu,
  onRegister,
}: OrganMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Sync transformation with world matrix
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.matrix.copy(matrix);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldNeedsUpdate = true;
    onRegister?.(organ.organ_id, mesh, matrix);

    return () => {
      onRegister?.(organ.organ_id, null, matrix);
    };
  }, [organ.organ_id, matrix, onRegister]);

  // Cardiac chamber bindings
  const chamber = useMemo(() => beatChamber(organ), [organ]);
  const isHeartBeating = useHeartStore((s) => chamber !== null && s.enabled);

  // Respiratory deformations
  const breath = useMemo(
    () => breathData(organ, worldBox, chamber !== null),
    [organ, worldBox, chamber],
  );

  const respiratoryPart = useMemo(() => {
    if (breath.breathRole === BREATH_ROLE.viscera) return "carrier" as const;
    if (breath.breathRole === BREATH_ROLE.heart) return "heart" as const;
    if (breath.breathRole !== BREATH_ROLE.vessel) return null;
    const name = organ.name_en.toLowerCase();
    if (name.includes("aorta")) return "anchor" as const;
    return name.includes("vena cava") ? ("vena cava" as const) : ("vessel" as const);
  }, [breath.breathRole, organ.name_en]);

  useEffect(() => {
    const node = meshRef.current;
    if (!node || respiratoryPart === null) return;
    return registerCarry(organ.organ_id, { mesh: node, part: respiratoryPart });
  }, [organ.organ_id, respiratoryPart]);

  // Shared cardiac deformation state
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

  // Cardiac heartbeat registration
  useEffect(() => {
    const node = meshRef.current;
    if (!isHeartBeating || !node || chamber === null || !beatUserData) return;

    return registerBeating(organ.organ_id, {
      mesh: node,
      chamber,
      wall: isChamberWall(organ),
      centre: beatUserData.beatCentre,
    });
  }, [chamber, isHeartBeating, organ.organ_id, beatUserData]);

  // Blood flow registration
  const flowKind = useMemo(() => vesselFlow(organ), [organ]);
  const isFlowSeedOrgan = useMemo(
    () => (flowKind ? isFlowSeed(flowKind, organ) : false),
    [flowKind, organ],
  );

  useEffect(() => {
    const node = meshRef.current;
    if (!node || !flowKind) return;
    return registerFlowing(organ.organ_id, {
      mesh: node,
      kind: flowKind,
      seed: isFlowSeedOrgan,
    });
  }, [organ.organ_id, flowKind, isFlowSeedOrgan]);

  // Dynamic mesh standard material
  const material = useMemo(() => {
    const isGhost = opacity < GHOST_CLICK_THROUGH;
    const finalAlpha = Math.max(0, Math.min(1, opacity * tissueOpacity(organ)));

    const mat = flowKind
      ? flowMaterial(flowKind)
      : new THREE.MeshStandardMaterial({
          roughness: tissueRoughness(organ.system),
          metalness: tissueMetalness(organ.system),
          transparent: finalAlpha < 0.999,
          opacity: finalAlpha,
          depthWrite: !isGhost,
          clippingPlanes: clippingPlanes.length > 0 ? clippingPlanes : null,
          clipShadows: true,
        });

    if (tissueDepthBias(organ) !== 0) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = tissueDepthBias(organ);
      mat.polygonOffsetUnits = tissueDepthBias(organ);
    }

    if (chamber !== null && beatUserData) {
      mat.userData = beatUserData;
      mat.onBeforeCompile = heartbeatOnBeforeCompile;
    } else if (breath.breathRole !== BREATH_ROLE.none) {
      mat.userData = { ...breath };
      mat.onBeforeCompile = breathOnBeforeCompile;
    }

    return mat;
  }, [organ, opacity, clippingPlanes, chamber, breath, flowKind, beatUserData]);

  // Color updates
  useEffect(() => {
    if (!material) return;
    const color = resolveSurfaceTint(
      organ,
      tone,
      selected,
      hovered,
      overlay,
      probeDepth,
      litGlow,
      coverageTouches,
      coverageBusiest,
    );
    material.color.copy(color);
  }, [
    material,
    organ,
    tone,
    selected,
    hovered,
    overlay,
    probeDepth,
    litGlow,
    coverageTouches,
    coverageBusiest,
  ]);

  // Interaction handlers
  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (pressTravelled() || shouldSuppressClick()) return;

      reportClick();

      if (e.nativeEvent.altKey) {
        onStudy(organ.organ_id, e.nativeEvent.shiftKey);
      } else {
        onSelect(organ.organ_id, e.nativeEvent.shiftKey);
      }
    },
    [organ.organ_id, onSelect, onStudy],
  );

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(organ.organ_id);
    },
    [organ.organ_id, onHover],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(null);
    },
    [onHover],
  );

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onContextMenu(organ.organ_id, e.clientX, e.clientY);
    },
    [organ.organ_id, onContextMenu],
  );

  if (!visible) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      matrix={matrix}
      matrixAutoUpdate={false}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onContextMenu={handleContextMenu}
    />
  );
});

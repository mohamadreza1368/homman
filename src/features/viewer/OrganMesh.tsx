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

// ---------------------------------------------------------------------------
// Organ Material & Appearance Engine
// ---------------------------------------------------------------------------

export function biologicalContourOnBeforeCompile(
  shader: THREE.WebGLProgramParametersWithUniforms,
) {
  const fragmentHook = "#include <opaque_fragment>";
  if (shader.fragmentShader.includes(fragmentHook)) {
    const contourCode = [
      fragmentHook,
      "vec3 viewDirNorm = normalize(-vViewPosition);",
      "vec3 normalNorm = normalize(vNormal);",
      "float contourFresnel = pow(1.0 - max(0.0, dot(normalNorm, viewDirNorm)), 3.2);",
      "gl_FragColor.rgb += vec3(0.08, 0.09, 0.12) * (contourFresnel * 0.35);",
    ].join("\n");
    shader.fragmentShader = shader.fragmentShader.replace(fragmentHook, contourCode);
  }
}

export class OrganMaterialEngine {
  private static readonly ACCENT_SELECT = new THREE.Color("#00a8e8");
  private static readonly WARN_PATHOLOGY = new THREE.Color("#e8a33d");
  private static readonly CRIT_PATHOLOGY = new THREE.Color("#c62828");
  private static readonly GLOW_LIT = new THREE.Color("#35e07a");
  private static readonly DEPTH_PROBE = new THREE.Color("#ffe8c4");

  public static resolveSurfaceColor(
    organ: ManifestOrgan,
    selected: boolean,
    hovered: boolean,
    overlay: PathologyOverlay | undefined,
    probeDepth: number | undefined,
    litGlow: number | undefined,
    coverageTouches: number | undefined,
    coverageBusiest: number | undefined,
  ): THREE.Color {
    const tint = tissueColour(organ).clone();

    if (overlay) {
      const severity = Math.min(Math.max(overlay.severity, 0), 1);
      const targetWarning =
        severity <= 0.5
          ? tint.clone().lerp(this.WARN_PATHOLOGY, severity * 2)
          : this.WARN_PATHOLOGY.clone().lerp(this.CRIT_PATHOLOGY, (severity - 0.5) * 2);
      tint.copy(targetWarning);
    }

    if (coverageTouches !== undefined && coverageBusiest !== undefined && coverageBusiest > 0) {
      const heat = coverageColour(coverageTouches, coverageBusiest);
      tint.lerp(heat, 0.65);
    }

    if (selected) {
      tint.lerp(this.ACCENT_SELECT, 0.7);
    } else if (hovered) {
      tint.offsetHSL(0, 0.05, 0.15);
    }

    if (litGlow !== undefined && litGlow > 0) {
      tint.lerp(this.GLOW_LIT, Math.min(litGlow, 1) * 0.8);
    } else if (probeDepth !== undefined) {
      tint.lerp(this.DEPTH_PROBE, Math.max(0.2, 1 - probeDepth * 0.15));
    }

    return tint;
  }

  public static createShaderMaterial(
    organ: ManifestOrgan,
    opacity: number,
    clippingPlanes: THREE.Plane[],
    chamber: string | null,
    beatUserData: unknown,
    breath: ReturnType<typeof breathData>,
  ): THREE.Material {
    const isGhost = opacity < GHOST_CLICK_THROUGH;
    const finalAlpha = Math.max(0, Math.min(1, opacity * tissueOpacity(organ)));

    const standardMat = new THREE.MeshStandardMaterial({
      roughness: tissueRoughness(organ.system),
      metalness: tissueMetalness(organ.system),
      transparent: finalAlpha < 0.999,
      opacity: finalAlpha,
      depthWrite: !isGhost && finalAlpha >= 0.999,
      clippingPlanes: clippingPlanes.length > 0 ? clippingPlanes : null,
      clipShadows: true,
    });

    const depthBias = tissueDepthBias(organ);
    if (depthBias !== 0) {
      standardMat.polygonOffset = true;
      standardMat.polygonOffsetFactor = depthBias;
      standardMat.polygonOffsetUnits = depthBias;
    }

    if (chamber !== null && beatUserData) {
      standardMat.userData = beatUserData;
      standardMat.onBeforeCompile = heartbeatOnBeforeCompile;
    } else if (breath.breathRole !== BREATH_ROLE.none) {
      standardMat.userData = { ...breath };
      standardMat.onBeforeCompile = breathOnBeforeCompile;
    } else {
      standardMat.onBeforeCompile = biologicalContourOnBeforeCompile;
    }

    return standardMat;
  }
}

// ---------------------------------------------------------------------------
// Organ Physiological Deformation Hook
// ---------------------------------------------------------------------------

function useOrganPhysiology(
  meshRef: React.RefObject<THREE.Mesh | null>,
  organ: ManifestOrgan,
  worldBox?: THREE.Box3,
  geometry?: THREE.BufferGeometry,
) {
  const chamber = useMemo(() => beatChamber(organ), [organ]);
  const isHeartBeating = useHeartStore((s) => chamber !== null && s.enabled);

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

  const beatUserData = useMemo(() => {
    if (chamber === null || !geometry) return null;
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

  const flowKind = useMemo(() => vesselFlow(organ), [organ]);
  const isFlowSeedOrgan = useMemo(
    () => (flowKind ? isFlowSeed(flowKind, organ) : false),
    [flowKind, organ],
  );

  useEffect(() => {
    const node = meshRef.current;
    if (!node) return;

    const unregisters: Array<() => void> = [];

    if (respiratoryPart !== null) {
      const unreg = registerCarry(organ.organ_id, { mesh: node, part: respiratoryPart });
      if (unreg) unregisters.push(unreg);
    }

    if (isHeartBeating && chamber !== null && beatUserData) {
      const unreg = registerBeating(organ.organ_id, {
        mesh: node,
        chamber,
        wall: isChamberWall(organ),
        centre: beatUserData.beatCentre,
      });
      if (unreg) unregisters.push(unreg);
    }

    if (flowKind) {
      const unreg = registerFlowing(organ.organ_id, {
        mesh: node,
        kind: flowKind,
        seed: isFlowSeedOrgan,
      });
      if (unreg) unregisters.push(unreg);
    }

    return () => {
      unregisters.forEach((fn) => fn());
    };
  }, [
    organ.organ_id,
    respiratoryPart,
    isHeartBeating,
    chamber,
    beatUserData,
    flowKind,
    isFlowSeedOrgan,
    meshRef,
  ]);

  return { chamber, breath, beatUserData, flowKind };
}

// ---------------------------------------------------------------------------
// 3D Organ Mesh Component
// ---------------------------------------------------------------------------

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
  tone: _tone,
  worldBox,
  clippingPlanes,
  onHover,
  onSelect,
  onStudy,
  onContextMenu,
  onRegister,
}: OrganMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

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

  const { chamber, breath, beatUserData, flowKind } = useOrganPhysiology(
    meshRef,
    organ,
    worldBox,
    geometry,
  );

  const material = useMemo(
    () =>
      OrganMaterialEngine.createShaderMaterial(
        organ,
        opacity,
        clippingPlanes,
        chamber,
        beatUserData,
        breath,
      ),
    [organ, opacity, clippingPlanes, chamber, beatUserData, breath],
  );

  const isHeartBeating = useHeartStore((s) => s.enabled);
  const flowMat = useMemo(
    () => (flowKind ? flowMaterial(flowKind) : null),
    [flowKind],
  );

  useEffect(() => {
    if (!("color" in material) || !(material.color instanceof THREE.Color)) return;
    const color = OrganMaterialEngine.resolveSurfaceColor(
      organ,
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
    selected,
    hovered,
    overlay,
    probeDepth,
    litGlow,
    coverageTouches,
    coverageBusiest,
  ]);

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
    >
      {flowMat && isHeartBeating && (
        <mesh
          geometry={geometry}
          material={flowMat}
          raycast={() => null}
          renderOrder={3}
        />
      )}
    </mesh>
  );
});

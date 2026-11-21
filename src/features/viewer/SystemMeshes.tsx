import { useGLTF } from "@react-three/drei";
import { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";

import { meshUrl, organsInFile } from "@/lib/manifest";
import type { AnatomyManifest, ManifestOrgan } from "@/lib/schemas";
import {
  isOrganVisible,
  organOpacity,
  useSceneStore,
} from "@/stores/sceneStore";
import { useStudyStore } from "@/stores/studyStore";
import { buildEyeGroups } from "./eyes";
import { EyeGlobe } from "./EyeGlobe";
import { busiestTouches } from "./coverage";
import { illuminationGlow } from "./depthStack";
import { keepsColour } from "./scan";
import { useExplodeMotion } from "./useExplodeMotion";
import { OrganMesh } from "./OrganMesh";

const DRACO_DECODER_LOCAL_PATH = "/draco/";

interface OrganGeometry {
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
}

export interface SystemMeshesProps {
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
}

export function SystemMeshes({
  manifest,
  file,
  clippingPlanes,
  explodeOffsets: offsets,
  scanBandEnabled,
  onMeasured,
  onContextMenu,
}: SystemMeshesProps) {
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

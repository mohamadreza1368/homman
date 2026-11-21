/**
 * HOOMAAN 3D Viewer - Vascular & Neural Supply Pathway Resolver
 * Resolves supplying arterial, venous, or nerve pathways servicing isolated anatomical targets.
 */

import { useEffect } from "react";
import * as THREE from "three";
import type { AnatomyManifest } from "@/lib/schemas";
import { useSceneStore } from "@/stores/sceneStore";
import { collectSupply, isSystemMeasured, SUPPLY_SYSTEM } from "./supply";

export function useVascularSupplyResolver(
  manifest: AnatomyManifest,
  boxesRef: React.RefObject<Map<string, THREE.Box3>>,
  geometryRevision: number,
) {
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const supplyRequest = useSceneStore((s) => s.supplyRequest);
  const resolveSupply = useSceneStore((s) => s.resolveSupply);
  const cancelSupply = useSceneStore((s) => s.cancelSupply);

  useEffect(() => {
    if (!supplyRequest) return;

    if (!isolatedOrganIds || isolatedOrganIds.length === 0) {
      cancelSupply();
      return;
    }

    const targetSystem = SUPPLY_SYSTEM[supplyRequest.kind];
    const candidateIds = manifest.organs
      .filter((o) => o.system === targetSystem)
      .map((o) => o.organ_id);

    if (candidateIds.length === 0) {
      cancelSupply();
      return;
    }

    if (!boxesRef.current || !isSystemMeasured(candidateIds, boxesRef.current)) {
      return;
    }

    const resolvedResults = collectSupply(isolatedOrganIds, candidateIds, boxesRef.current);
    resolveSupply(resolvedResults);
  }, [
    supplyRequest,
    isolatedOrganIds,
    geometryRevision,
    manifest.organs,
    boxesRef,
    resolveSupply,
    cancelSupply,
  ]);
}

/**
 * HOOMAAN AI Tutor - Anatomical Context & Clinical Prompt Synthesizer
 * Aggregates 3D scene state, physiological simulator parameters,
 * and organ metadata into structured prompt metadata for the AI engine.
 */

import { useCallback, useMemo } from "react";
import type { ManifestOrgan, SessionMode } from "@/lib/schemas";
import { groupNames, organLabel } from "@/stores/sceneStore";
import { useScanStore } from "@/stores/scanStore";
import { useHeartStore } from "@/stores/heartStore";
import { useBreathStore } from "@/stores/breathStore";
import { CURRENT_CROSSING } from "@/features/viewer/scanCrossing";
import { CURRENT_LEVEL } from "@/features/viewer/vertebralLevel";
import { scannerAim } from "./scannerContext";
import { heartAim } from "./heartContext";
import { breathAim } from "./breathContext";

export interface AnatomyContextBuilderOptions {
  loadedOrgans: Record<string, ManifestOrgan>;
  selectedOrganIds: string[];
  isolatedOrganIds: string[] | null;
  hiddenSystems: string[];
  mode: SessionMode;
  aimHintLearned: boolean;
  isPersian: boolean;
}

export function useAnatomyContextBuilder({
  loadedOrgans,
  selectedOrganIds,
  isolatedOrganIds,
  hiddenSystems,
  mode,
  aimHintLearned,
}: AnatomyContextBuilderOptions) {
  const scanEnabled = useScanStore((s) => s.enabled);
  const scanPinned = useScanStore((s) => s.pinned);
  const scanPlane = useScanStore((s) => s.plane);

  const heartEnabled = useHeartStore((s) => s.enabled);
  const heartRhythm = useHeartStore((s) => s.rhythm);
  const heartSound = useHeartStore((s) => s.sound);

  const breathEnabled = useBreathStore((s) => s.enabled);
  const breathPattern = useBreathStore((s) => s.pattern);

  const visibleStructures = useMemo(
    () => Object.values(loadedOrgans).filter((organ) => !hiddenSystems.includes(organ.system)),
    [loadedOrgans, hiddenSystems],
  );

  const selectableGroups = useMemo(() => groupNames(visibleStructures), [visibleStructures]);

  const getScannerContext = useCallback(
    () =>
      scannerAim({
        enabled: scanEnabled,
        still: scanPinned || useScanStore.getState().held,
        plane: scanPlane,
        mode,
        selected: selectedOrganIds.length,
        level: CURRENT_LEVEL.value,
        organIds: CURRENT_CROSSING.value.organIds,
        total: CURRENT_CROSSING.value.total,
        organ: (id) => {
          const item = loadedOrgans[id];
          return item
            ? {
                organ_id: item.organ_id,
                ta2_latin: item.ta2_latin,
                name_en: item.name_en,
                system: item.system,
              }
            : null;
        },
      }),
    [loadedOrgans, mode, scanEnabled, scanPinned, scanPlane, selectedOrganIds.length],
  );

  const activeHeartAim = useMemo(
    () => heartAim({ enabled: heartEnabled, mode, rhythm: heartRhythm, sound: heartSound }),
    [heartEnabled, heartRhythm, heartSound, mode],
  );

  const activeBreathAim = useMemo(
    () =>
      breathAim({
        enabled: breathEnabled,
        mode,
        pattern: breathPattern,
        heartEnabled,
        rhythm: heartRhythm,
      }),
    [breathEnabled, breathPattern, heartEnabled, heartRhythm, mode],
  );

  const activeAimTarget = useMemo(() => {
    if (aimHintLearned) return null;
    return getScannerContext() ?? activeHeartAim ?? activeBreathAim ?? null;
  }, [aimHintLearned, getScannerContext, activeHeartAim, activeBreathAim]);

  const selectedOrganLabels = useMemo(
    () =>
      selectedOrganIds
        .map((id) => (loadedOrgans[id] ? organLabel(loadedOrgans[id]) : null))
        .filter(Boolean) as string[],
    [selectedOrganIds, loadedOrgans],
  );

  const isolatedOrganLabels = useMemo(
    () =>
      isolatedOrganIds
        ? (isolatedOrganIds
            .map((id) => (loadedOrgans[id] ? organLabel(loadedOrgans[id]) : null))
            .filter(Boolean) as string[])
        : null,
    [isolatedOrganIds, loadedOrgans],
  );

  const activeSystemsSet = useMemo(
    () => new Set(visibleStructures.map((organ) => organ.system)),
    [visibleStructures],
  );

  return {
    visibleStructures,
    selectableGroups,
    activeAimTarget,
    selectedOrganLabels,
    isolatedOrganLabels,
    getScannerContext,
    activeHeartAim,
    activeBreathAim,
    activeSystemsSet,
  };
}

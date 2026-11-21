/**
 * HOOMAAN Memory Laboratory - 3D Hologram Scene Orchestration Hook
 *
 * Clean-room hook managing WebGL lifecycle, organ mesh projections,
 * audio synthesizer synchronization, and viewport margins.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { loadManifest, meshUrl } from "@/lib/manifest";
import type { ManifestOrgan } from "@/lib/schemas";
import { useSceneStore } from "@/stores/sceneStore";
import { createLabSound, storedLabSound, storeLabSound, type LabSound } from "./labSound";
import { createBodyHologram, type BodyHologram } from "./scene/bodyHologram";
import type { BrainStructure } from "./scene/brainLoader";
import {
  createMemoryScene,
  type GraphicsStatus,
  type LabPhase,
  type MemoryScene,
} from "./scene/memoryScene";
import {
  EXCLUDE_SURFACE_FILTER,
  formatDiagnosticError,
  persistFocusSetting,
  retrievePersistedFocus,
} from "./memoryLabUtils";
import type { Memory } from "./memories";

interface HologramLabSceneOptions {
  containerRootRef: React.RefObject<HTMLDivElement | null>;
  webglStageRef: React.RefObject<HTMLDivElement | null>;
  avatarContainerRef: React.RefObject<HTMLDivElement | null>;
  memoryList: Memory[] | null;
  onHoverMemory: (key: string | null) => void;
  onSelectMemory: (key: string | null) => void;
  onError: (msg: string) => void;
}

export function useHologramLabScene({
  containerRootRef,
  webglStageRef,
  avatarContainerRef,
  memoryList,
  onHoverMemory,
  onSelectMemory,
  onError,
}: HologramLabSceneOptions) {
  const sceneInstanceRef = useRef<MemoryScene | null>(null);
  const avatarInstanceRef = useRef<BodyHologram | null>(null);
  const audioSynthRef = useRef<LabSound | null>(null);

  const [currentHoloPhase, setCurrentHoloPhase] = useState<LabPhase>("boot");
  const [mappedMemoryCount, setMappedMemoryCount] = useState(0);
  const [hardwareGraphicsStatus, setHardwareGraphicsStatus] = useState<GraphicsStatus | null>(null);
  const [isSoftwareOnlyFallback, setIsSoftwareOnlyFallback] = useState(false);
  const [anatomicalAtlas, setAnatomicalAtlas] = useState<readonly ManifestOrgan[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const [isAudioEnabled, setIsAudioEnabled] = useState(storedLabSound);
  const [isFocusReaderActive, setIsFocusReaderActive] = useState(retrievePersistedFocus);
  const focusStateTracker = useRef(isFocusReaderActive);

  // Audio synthesizer lifecycle
  useEffect(() => {
    storeLabSound(isAudioEnabled);
    if (!isAudioEnabled) {
      audioSynthRef.current?.close();
      audioSynthRef.current = null;
      return;
    }
    audioSynthRef.current = createLabSound(isAudioEnabled);
    return () => {
      audioSynthRef.current?.close();
      audioSynthRef.current = null;
    };
  }, [isAudioEnabled]);

  // Focus reader persistence
  useEffect(() => {
    focusStateTracker.current = isFocusReaderActive;
    persistFocusSetting(isFocusReaderActive);
    sceneInstanceRef.current?.setFilm(!isFocusReaderActive);
  }, [isFocusReaderActive]);

  // Initialize 3D scene and anatomical avatar
  useEffect(() => {
    const stageDom = webglStageRef.current;
    if (!stageDom || !memoryList || memoryList.length === 0) return;

    let cancelled = false;
    const sceneStoreRef = useSceneStore.getState();
    const existingAtlas = sceneStoreRef.genderModel === "male" ? sceneStoreRef.manifest : null;

    (existingAtlas ? Promise.resolve(existingAtlas) : loadManifest("male"))
      .then((atlasManifest) => {
        if (cancelled) return;
        setAnatomicalAtlas(atlasManifest.organs);

        const brainNodes: BrainStructure[] = atlasManifest.organs
          .filter((organ) => organ.path?.includes("Brain") && organ.mesh_file === "nervous_male.glb")
          .map((organ) => ({
            node: organ.node,
            name: organ.name_en.replace(/\s*\((left|right)\)$/, ""),
            latin: organ.ta2_latin,
            region: organ.path![organ.path!.indexOf("Brain") + 1] ?? "Brain",
            side: /\(left\)$/.test(organ.name_en)
              ? "left"
              : /\(right\)$/.test(organ.name_en)
                ? "right"
                : "midline",
          }));

        try {
          sceneInstanceRef.current = createMemoryScene(stageDom, {
            meshUrl: meshUrl("nervous_male.glb"),
            structures: brainNodes,
            dracoPath: "/draco/",
            memories: memoryList.map(({ key, kind }) => ({ key, kind })),
            onGraphics: setHardwareGraphicsStatus,
            onHover: onHoverMemory,
            onSelect: onSelectMemory,
            onPhase: (nextStage, count) => {
              setCurrentHoloPhase(nextStage);
              setMappedMemoryCount(count);
              if (audioSynthRef.current) {
                audioSynthRef.current.phase(nextStage);
              }
            },
            onError: (reason) => onError(formatDiagnosticError(reason)),
          });
          sceneInstanceRef.current.setFilm(!focusStateTracker.current);
        } catch {
          setIsSoftwareOnlyFallback(true);
          return;
        }

        const avatarDom = avatarContainerRef.current;
        const mainFrame = containerRootRef.current;
        if (!avatarDom || !mainFrame || !sceneInstanceRef.current) return;

        const bodySurfaceStructures: BrainStructure[] = atlasManifest.organs
          .filter((organ) => organ.mesh_file === "regional_male.glb" && !EXCLUDE_SURFACE_FILTER.test(organ.name_en))
          .map((organ) => ({
            node: organ.node,
            name: organ.name_en,
            latin: organ.ta2_latin,
            region: "Body",
            side: "midline",
          }));

        avatarInstanceRef.current = createBodyHologram(avatarDom, {
          meshUrl: meshUrl("regional_male.glb"),
          structures: bodySurfaceStructures,
          dracoPath: "/draco/",
          host: sceneInstanceRef.current,
          frame: mainFrame,
          fileUrl: meshUrl,
          onError: () => {
            avatarInstanceRef.current?.dispose();
            avatarInstanceRef.current = null;
          },
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) onError(formatDiagnosticError(err));
      });

    return () => {
      cancelled = true;
      sceneInstanceRef.current?.dispose();
      sceneInstanceRef.current = null;
      avatarInstanceRef.current?.dispose();
      avatarInstanceRef.current = null;
    };
  }, [
    avatarContainerRef,
    containerRootRef,
    memoryList,
    onError,
    onHoverMemory,
    onSelectMemory,
    reconnectAttempts,
    webglStageRef,
  ]);

  const reconnect = useCallback(() => {
    setReconnectAttempts((c) => c + 1);
  }, []);

  return {
    sceneInstanceRef,
    avatarInstanceRef,
    audioSynthRef,
    currentHoloPhase,
    mappedMemoryCount,
    hardwareGraphicsStatus,
    isSoftwareOnlyFallback,
    setIsSoftwareOnlyFallback,
    anatomicalAtlas,
    isAudioEnabled,
    setIsAudioEnabled,
    toggleAudio: () => setIsAudioEnabled((v) => !v),
    isFocusReaderActive,
    setIsFocusReaderActive,
    toggleFocusReader: () => setIsFocusReaderActive((v) => !v),
    reconnect,
  };
}

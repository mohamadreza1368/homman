import { useEffect } from "react";
import { stepMemory } from "./memories";
import type { LabPhase } from "./scene/memorySceneTypes";

interface UseMemoryHotkeysOptions {
  isHelpGuideVisible: boolean;
  setIsHelpGuideVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
  isExpandedReader: boolean;
  setIsExpandedReader: (v: boolean | ((prev: boolean) => boolean)) => void;
  selectedMemoryKey: string | null;
  selectMemoryItem: (key: string | null) => void;
  isRailNavOpen: boolean;
  setIsRailNavOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleLabDismissal: () => void;
  currentHoloPhase: LabPhase;
  activeKeysList: string[];
}

export function useMemoryHotkeys({
  isHelpGuideVisible,
  setIsHelpGuideVisible,
  isExpandedReader,
  setIsExpandedReader,
  selectedMemoryKey,
  selectMemoryItem,
  isRailNavOpen,
  setIsRailNavOpen,
  handleLabDismissal,
  currentHoloPhase,
  activeKeysList,
}: UseMemoryHotkeysOptions) {
  useEffect(() => {
    const handleGlobalKeyDown = (evt: KeyboardEvent) => {
      if (evt.ctrlKey || evt.altKey || evt.metaKey) return;

      if (isHelpGuideVisible) {
        if (evt.key === "Escape" || evt.key === "?") {
          setIsHelpGuideVisible(false);
        }
        return;
      }

      if (evt.key === "?") {
        setIsHelpGuideVisible(true);
        return;
      }

      const targetTag = (evt.target as HTMLElement | null)?.closest?.(
        "input, textarea, select, [contenteditable='true']",
      );

      if (
        (evt.key === "ArrowLeft" || evt.key === "ArrowRight") &&
        !targetTag &&
        currentHoloPhase === "live" &&
        !evt.repeat
      ) {
        const nextKey = stepMemory(activeKeysList, selectedMemoryKey, evt.key === "ArrowLeft" ? -1 : 1);
        if (nextKey && nextKey !== selectedMemoryKey) {
          selectMemoryItem(nextKey);
        }
        evt.preventDefault();
        return;
      }

      if (
        evt.key === "Enter" &&
        selectedMemoryKey &&
        !targetTag &&
        !(evt.target as HTMLElement | null)?.closest?.("button, a")
      ) {
        setIsExpandedReader((w) => !w);
        evt.preventDefault();
        return;
      }

      if (evt.key === "Escape") {
        if (isExpandedReader) {
          setIsExpandedReader(false);
        } else if (selectedMemoryKey) {
          selectMemoryItem(null);
        } else if (isRailNavOpen) {
          setIsRailNavOpen(false);
        } else {
          handleLabDismissal();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    activeKeysList,
    currentHoloPhase,
    handleLabDismissal,
    isExpandedReader,
    setIsExpandedReader,
    isHelpGuideVisible,
    setIsHelpGuideVisible,
    isRailNavOpen,
    setIsRailNavOpen,
    selectMemoryItem,
    selectedMemoryKey,
  ]);
}

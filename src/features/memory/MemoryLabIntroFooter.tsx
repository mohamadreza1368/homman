/**
 * HOOMAAN Memory Lab - Boot Progression Footer
 */

import type { Memory } from "./memories";
import type { LabPhase } from "./scene/memoryScene";

interface MemoryLabIntroFooterProps {
  currentHoloPhase: LabPhase;
  isSlowInitialLoad: boolean;
  mappedMemoryCount: number;
  totalRegisteredMemories: number;
  memoryLookupMap: Map<string, Memory>;
  memoryList: Memory[];
}

export function MemoryLabIntroFooter({
  currentHoloPhase,
  isSlowInitialLoad,
  mappedMemoryCount,
  totalRegisteredMemories,
  memoryLookupMap,
  memoryList,
}: MemoryLabIntroFooterProps) {
  const currentKey = memoryList[Math.max(0, mappedMemoryCount - 1)]?.key;
  const currentTitle = (currentKey ? memoryLookupMap.get(currentKey)?.title : "") ?? "";

  return (
    <>
      <div className="ml-row">
        <div className="ml-status">
          {currentHoloPhase === "boot" &&
            (isSlowInitialLoad
              ? "STILL LOADING · THIS COMPUTER IS TAKING LONGER THAN USUAL"
              : "ACCESSING STUDY MEMORY")}
          {currentHoloPhase === "deploy" && "DEPLOYING HOLOGRAPHIC PROJECTION"}
          {currentHoloPhase === "materialize" && "RECONSTRUCTING NEURAL SURFACE"}
          {currentHoloPhase === "mapping" && `MAPPING STUDY MEMORY · ${currentTitle.toUpperCase()}`}
        </div>
        <div className="ml-percent">
          {mappedMemoryCount}
          <small>/ {totalRegisteredMemories} MAPPED</small>
        </div>
      </div>
      <div className="ml-bar">
        <i
          style={{
            width: `${totalRegisteredMemories > 0 ? (mappedMemoryCount / totalRegisteredMemories) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="ml-skip">CLICK TO SKIP</div>
    </>
  );
}

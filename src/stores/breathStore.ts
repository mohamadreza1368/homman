import { create } from "zustand";

import type { BreathPatternId } from "@/features/viewer/breathing";

/**
 * Thoracic respiratory cycle state for HOOMAAN anatomical physiology simulation.
 * Resets to resting/off across sessions so new launches present a quiescent anatomical model.
 */
interface BreathState {
  enabled: boolean;
  pattern: BreathPatternId;
  toggle: () => void;
  setPattern: (pattern: BreathPatternId) => void;
}

export const useBreathStore = create<BreathState>()((set) => ({
  enabled: false,
  pattern: "quiet",
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setPattern: (pattern: BreathPatternId) => set({ pattern }),
}));

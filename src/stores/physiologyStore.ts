import { create } from "zustand";

interface PhysiologyStoreState {
  active: boolean;
  toggle: () => void;
  setActive: (active: boolean) => void;
}

/**
 * Global UI state indicating whether anatomical physiology simulation mode
 * (heartbeat, thoracic respiration, ECG readout HUD) is active in the viewport.
 */
export const usePhysiologyStore = create<PhysiologyStoreState>((set) => ({
  active: false,
  toggle: () => set((state) => ({ active: !state.active })),
  setActive: (active: boolean) => set({ active }),
}));

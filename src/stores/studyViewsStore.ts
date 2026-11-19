import { create } from "zustand";

import type { AuxiliaryView } from "@/features/viewer/studyLayout";

/**
 * Manages orthogonal and auxiliary multi-viewport layout in HOOMAAN study mode.
 * Governs spatial quadrants (anterior, left, superior projections) alongside the primary perspective.
 */
export const AUXILIARY_VIEWS: AuxiliaryView[] = ["anterior", "left", "superior"];

interface StudyViewsState {
  wanted: boolean;
  active: AuxiliaryView[];
  setWanted: (wanted: boolean) => void;
  toggleView: (view: AuxiliaryView) => void;
}

export const useStudyViewsStore = create<StudyViewsState>()((set) => ({
  wanted: false,
  active: [...AUXILIARY_VIEWS],
  setWanted: (wanted: boolean) => set({ wanted }),
  toggleView: (view: AuxiliaryView) =>
    set((state) => {
      const isPresent = state.active.includes(view);
      const nextActive = isPresent
        ? state.active.filter((v) => v !== view)
        : AUXILIARY_VIEWS.filter((v) => v === view || state.active.includes(v));
      return { active: nextActive };
    }),
}));

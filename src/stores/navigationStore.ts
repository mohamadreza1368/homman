import { create } from "zustand";

export type LeftPanelTab = "atlas" | "diseases" | "education" | "study" | "usage";

interface NavigationStoreState {
  leftPanelTab: LeftPanelTab;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  diseaseSelectedOnly: boolean;
  setDiseaseSelectedOnly: (only: boolean) => void;
  openDiseasesForSelection: () => void;
}

/**
 * Global navigation store orchestrating sidebar tab selection and contextual
 * panel switches between the 3D viewport actions and sidebar modules.
 */
export const useNavigationStore = create<NavigationStoreState>((set) => ({
  leftPanelTab: "atlas",
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  diseaseSelectedOnly: false,
  setDiseaseSelectedOnly: (diseaseSelectedOnly) => set({ diseaseSelectedOnly }),
  openDiseasesForSelection: () => {
    set({ leftPanelTab: "diseases", diseaseSelectedOnly: true });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hoomaan:ensure-tree-open"));
    }
  },
}));

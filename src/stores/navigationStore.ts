import { create } from "zustand";

export type LeftPanelTab = "atlas" | "surgical" | "diseases" | "education" | "study" | "usage";
export type MicroAnatomyScene = "nephron" | "hepatic_lobule" | "alveolus" | "dental";

interface NavigationStoreState {
  leftPanelTab: LeftPanelTab;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  diseaseSelectedOnly: boolean;
  setDiseaseSelectedOnly: (only: boolean) => void;
  openDiseasesForSelection: () => void;
  openSurgicalAtlas: () => void;
  microAnatomyScene: MicroAnatomyScene | null;
  setMicroAnatomyScene: (scene: MicroAnatomyScene | null) => void;
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
  openSurgicalAtlas: () => {
    set({ leftPanelTab: "surgical" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hoomaan:ensure-tree-open"));
    }
  },
  microAnatomyScene: null,
  setMicroAnatomyScene: (microAnatomyScene) => set({ microAnatomyScene }),
}));

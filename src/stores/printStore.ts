import { create } from "zustand";

import type { PrintDocument } from "@/features/study/printDocument";

/**
 * State store managing academic sheet printing and PDF generation in HOOMAAN.
 * Mounted at application root level to bypass side panel container clipping.
 */
interface PrintState {
  document: PrintDocument | null;
  show: (document: PrintDocument) => void;
  close: () => void;
}

export const usePrintStore = create<PrintState>()((set) => ({
  document: null,
  show: (document: PrintDocument) => set({ document }),
  close: () => set({ document: null }),
}));

import { create } from "zustand";

import { readLocal, writeLocal } from "@/lib/localStore";
import { scanTint, type ScanTintId } from "@/features/viewer/scanTints";
import type { SectionPlaneName } from "@/features/viewer/axialSlice";

/**
 * State store for the HOOMAAN anatomical scanner and cross-sectional tomography suite.
 *
 * Controls planar sweep trajectory, axial/frontal slicing planes, radiological windowing,
 * tissue highlight tints, and depth probing.
 */
const STORAGE_KEYS = {
  sweepOnAnswer: "hoomaan.scan.sweepOnAnswer.v1",
  tint: "hoomaan.scan.tint.v1",
  reveal: "hoomaan.scan.reveal.v1",
  readout: "hoomaan.scan.readout.v1",
  panel: "hoomaan.scan.panel.v1",
  ghost: "hoomaan.scan.ghost.v1",
  sound: "hoomaan.scan.sound.v1",
  axial: "hoomaan.scan.axial.v1",
  cut: "hoomaan.scan.cut.v1",
  torch: "hoomaan.scan.torch.v1",
  detail: "hoomaan.scan.detail.v1",
  plane: "hoomaan.scan.plane.v1",
} as const;

function getStoredPlane(): SectionPlaneName {
  return readLocal(STORAGE_KEYS.plane) === "front" ? "front" : "axial";
}

function getStoredBoolean(key: string, defaultOn = false): boolean {
  const value = readLocal(key);
  return defaultOn ? value !== "off" : value === "on";
}

function getStoredTint(): ScanTintId {
  return scanTint(readLocal(STORAGE_KEYS.tint)).id;
}

interface ScannerState {
  enabled: boolean;
  held: boolean;
  pinned: boolean;
  at: number;
  byAssistant: boolean;
  sections: number;
  sweepOnAnswer: boolean;
  tint: ScanTintId;
  reveal: boolean;
  readout: boolean;
  panel: boolean;
  ghost: boolean;
  sound: boolean;
  axial: boolean;
  cut: boolean;
  torch: boolean;
  detail: boolean;
  plane: SectionPlaneName;
  elsewhere: number;

  toggle: () => void;
  hold: (at: number) => void;
  putAt: (at: number) => void;
  step: (by: number) => void;
  sectionTaken: () => void;
  release: () => void;
  togglePin: () => void;
  setSweepOnAnswer: (on: boolean) => void;
  setTint: (tint: ScanTintId) => void;
  setReveal: (on: boolean) => void;
  toggleReadout: () => void;
  togglePanel: () => void;
  setGhost: (on: boolean) => void;
  setSound: (on: boolean) => void;
  setAxial: (on: boolean) => void;
  setCut: (on: boolean) => void;
  setTorch: (on: boolean) => void;
  setDetail: (on: boolean) => void;
  setPlane: (plane: SectionPlaneName) => void;
}

const clampFraction = (val: number) => Math.max(0, Math.min(1, val));

export const useScanStore = create<ScannerState>()((set, get) => ({
  enabled: false,
  held: false,
  pinned: false,
  at: 0.5,
  byAssistant: false,
  sections: 0,
  sweepOnAnswer: getStoredBoolean(STORAGE_KEYS.sweepOnAnswer, true),
  tint: getStoredTint(),
  reveal: getStoredBoolean(STORAGE_KEYS.reveal, false),
  readout: getStoredBoolean(STORAGE_KEYS.readout, true),
  panel: getStoredBoolean(STORAGE_KEYS.panel, true),
  ghost: getStoredBoolean(STORAGE_KEYS.ghost, false),
  sound: getStoredBoolean(STORAGE_KEYS.sound, false),
  axial: getStoredBoolean(STORAGE_KEYS.axial, false),
  cut: getStoredBoolean(STORAGE_KEYS.cut, true),
  torch: getStoredBoolean(STORAGE_KEYS.torch, false),
  detail: getStoredBoolean(STORAGE_KEYS.detail, false),
  plane: getStoredPlane(),
  elsewhere: 0.5,

  toggle: () =>
    set((state) => ({
      enabled: !state.enabled,
      held: false,
      pinned: false,
      byAssistant: false,
    })),

  hold: (at: number) =>
    set({
      held: true,
      at: clampFraction(at),
      byAssistant: false,
    }),

  putAt: (at: number) =>
    set({
      enabled: true,
      pinned: true,
      held: false,
      at: clampFraction(at),
      byAssistant: true,
    }),

  step: (by: number) => {
    if (by === 0) return;
    set((state) => ({
      at: clampFraction(state.at + by),
      pinned: true,
      byAssistant: false,
    }));
  },

  sectionTaken: () => set((state) => ({ sections: state.sections + 1 })),
  release: () => set({ held: false }),
  togglePin: () => set((state) => ({ pinned: !state.pinned, byAssistant: false })),

  setSweepOnAnswer: (on: boolean) => {
    if (on === get().sweepOnAnswer) return;
    writeLocal(STORAGE_KEYS.sweepOnAnswer, on ? "on" : "off");
    set({ sweepOnAnswer: on });
  },

  setTint: (tint: ScanTintId) => {
    if (tint === get().tint) return;
    writeLocal(STORAGE_KEYS.tint, tint);
    set({ tint });
  },

  setReveal: (on: boolean) => {
    if (on === get().reveal) return;
    writeLocal(STORAGE_KEYS.reveal, on ? "on" : "off");
    set({ reveal: on });
  },

  toggleReadout: () => {
    const next = !get().readout;
    writeLocal(STORAGE_KEYS.readout, next ? "on" : "off");
    set({ readout: next });
  },

  togglePanel: () => {
    const next = !get().panel;
    writeLocal(STORAGE_KEYS.panel, next ? "on" : "off");
    set({ panel: next });
  },

  setGhost: (on: boolean) => {
    if (on === get().ghost) return;
    writeLocal(STORAGE_KEYS.ghost, on ? "on" : "off");
    set({ ghost: on });
  },

  setSound: (on: boolean) => {
    if (on === get().sound) return;
    writeLocal(STORAGE_KEYS.sound, on ? "on" : "off");
    set({ sound: on });
  },

  setAxial: (on: boolean) => {
    if (on === get().axial) return;
    writeLocal(STORAGE_KEYS.axial, on ? "on" : "off");
    set({ axial: on });
  },

  setCut: (on: boolean) => {
    if (on === get().cut) return;
    writeLocal(STORAGE_KEYS.cut, on ? "on" : "off");
    set({ cut: on });
  },

  setTorch: (on: boolean) => {
    if (on === get().torch) return;
    writeLocal(STORAGE_KEYS.torch, on ? "on" : "off");
    set({ torch: on });
  },

  setDetail: (on: boolean) => {
    if (on === get().detail) return;
    writeLocal(STORAGE_KEYS.detail, on ? "on" : "off");
    set({ detail: on });
  },

  setPlane: (plane: SectionPlaneName) => {
    const state = get();
    if (plane === state.plane) return;
    writeLocal(STORAGE_KEYS.plane, plane);
    set({
      plane,
      at: state.elsewhere,
      elsewhere: state.at,
      byAssistant: false,
    });
  },
}));

export function scanIsStill(state: Pick<ScannerState, "held" | "pinned">): boolean {
  return state.held || state.pinned;
}

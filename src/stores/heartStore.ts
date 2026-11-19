import { create } from "zustand";

import { readLocal, writeLocal } from "@/lib/localStore";
import { primeHeartSound } from "@/features/viewer/heartSound";
import type { RhythmId } from "@/features/viewer/rhythms";

/**
 * Cardiac simulation and auscultation sound controller for HOOMAAN.
 *
 * Audio preferences are preserved across sessions; simulation state and rhythm
 * initialize to inactive and normal sinus rhythm respectively upon launch.
 */
const CARDIAC_SOUND_STORAGE_KEY = "hoomaan.heart.sound.v1";

function getInitialAudioPreference(): boolean {
  return readLocal(CARDIAC_SOUND_STORAGE_KEY) === "on";
}

interface CardiacSimulationState {
  enabled: boolean;
  sound: boolean;
  rhythm: RhythmId;
  toggle: () => void;
  setSound: (active: boolean) => void;
  setRhythm: (rhythm: RhythmId) => void;
}

export const useHeartStore = create<CardiacSimulationState>()((set, get) => ({
  enabled: false,
  sound: getInitialAudioPreference(),
  rhythm: "normal",
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setSound: (active: boolean) => {
    if (active === get().sound) return;
    writeLocal(CARDIAC_SOUND_STORAGE_KEY, active ? "on" : "off");
    set({ sound: active });
  },
  setRhythm: (rhythm: RhythmId) => set({ rhythm }),
}));

/**
 * Initiates cardiac simulation on a target rhythm upon assistant or clinical command.
 * Primes browser web audio context if sound is activated.
 */
export function startHeartRhythm(rhythm: RhythmId, sound: boolean | null): void {
  const store = useHeartStore.getState();
  if (sound !== null) {
    store.setSound(sound);
  }
  if (useHeartStore.getState().sound) {
    primeHeartSound();
  }
  store.setRhythm(rhythm);
  if (!store.enabled) {
    store.toggle();
  }
}

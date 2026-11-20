import { create } from "zustand";

import { readLocal, writeLocal } from "@/lib/localStore";
import { primeHeartSound } from "@/features/viewer/heartSound";
import type { RhythmId } from "@/features/viewer/rhythms";
import {
  evaluateChamberKinematics,
  evaluateEcgSignalVoltage,
  type HeartRateMode,
} from "@/features/viewer/cardiacCycleEngine";

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

export function mapRhythmToCycleMode(rhythm: RhythmId): HeartRateMode {
  if (rhythm.includes("tachycardia")) return "tachycardia";
  if (rhythm.includes("bradycardia")) return "bradycardia";
  if (rhythm === "asystole") return "asystole";
  if (rhythm.includes("fibrillation")) return "ventricular_fibrillation";
  return "normal";
}

interface CardiacSimulationState {
  enabled: boolean;
  sound: boolean;
  rhythm: RhythmId;
  toggle: () => void;
  setSound: (active: boolean) => void;
  setRhythm: (rhythm: RhythmId) => void;
  getKinematics: (elapsedSeconds: number) => ReturnType<typeof evaluateChamberKinematics>;
  getEcgVoltage: (elapsedSeconds: number) => number;
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
  getKinematics: (elapsedSeconds: number) =>
    evaluateChamberKinematics(elapsedSeconds, mapRhythmToCycleMode(get().rhythm)),
  getEcgVoltage: (elapsedSeconds: number) =>
    evaluateEcgSignalVoltage(elapsedSeconds, mapRhythmToCycleMode(get().rhythm)),
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

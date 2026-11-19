import { create } from "zustand";

import { startBridge, stopBridge, bridgeStatus, type BridgeStatus } from "@/lib/ipc";

/**
 * Manages external IPC bridge lifecycle and external streaming prose for HOOMAAN.
 *
 * Direct communication between the desktop application and local clients over IPC pipes.
 * Ephemeral external prose is isolated and kept strictly separate from the clinical assistant
 * and persistent student journal.
 */
export const UNKNOWN_BRIDGE: BridgeStatus = {
  supported: false,
  running: false,
  pipe: null,
  accepted: 0,
  refused: 0,
  server: null,
};

interface ExternalProseEntry {
  id: string;
  text: string;
}

interface BridgeState {
  status: BridgeStatus | null;
  prose: ExternalProseEntry[];
  error: string | null;
  busy: boolean;

  receiveProse: (id: string, text: string) => void;
  refresh: () => Promise<void>;
  turnOn: () => Promise<void>;
  turnOff: () => Promise<void>;
}

export const useBridgeStore = create<BridgeState>()((set, get) => {
  let activeSequence = 0;

  const commitStatus = (status: BridgeStatus) => {
    set({
      status,
      ...(!status.running ? { prose: [] } : {}),
    });
  };

  return {
    status: null,
    prose: [],
    error: null,
    busy: false,

    receiveProse: (id: string, text: string) => {
      const { status, busy } = get();
      if (!status?.running || busy) return;
      set((state) => ({
        prose: [...state.prose.slice(-19), { id, text }],
      }));
    },

    refresh: async () => {
      if (get().busy) return;
      const sequence = activeSequence;
      try {
        const nextStatus = await bridgeStatus();
        if (sequence === activeSequence) {
          commitStatus(nextStatus);
        }
      } catch (err) {
        if (sequence === activeSequence) {
          set({ error: String(err) });
        }
      }
    },

    turnOn: async () => {
      if (get().busy) return;
      activeSequence++;
      set({ busy: true, error: null });
      try {
        const result = await startBridge();
        commitStatus(result);
      } catch (err) {
        set({ error: String(err) });
      } finally {
        set({ busy: false });
      }
    },

    turnOff: async () => {
      if (get().busy) return;
      activeSequence++;
      set({ busy: true, error: null });
      try {
        const result = await stopBridge();
        commitStatus(result);
      } catch (err) {
        set({ error: String(err) });
      } finally {
        set({ busy: false });
      }
    },
  };
});

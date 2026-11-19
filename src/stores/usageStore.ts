import { create } from "zustand";

import type { Grain } from "@/features/usage/aggregate";
import { recordTokenUsage, tokenUsage, type UsageBucket, type UsageInput } from "@/lib/studyDb";

/**
 * AI inference token consumption and analytics tracking for HOOMAAN.
 * Records model usage metrics into local SQLite store without interrupting user turns on database errors.
 */
export const WINDOW_DAYS: Record<Grain, number> = {
  day: 14,
  week: 84,
  month: 366,
};

interface ConsumptionState {
  buckets: UsageBucket[];
  grain: Grain;
  loaded: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  setGrain: (grain: Grain) => Promise<void>;
  record: (usage: UsageInput) => Promise<void>;
  dismissError: () => void;
}

export const useUsageStore = create<ConsumptionState>()((set, get) => ({
  buckets: [],
  grain: "day",
  loaded: false,
  error: null,

  refresh: async () => {
    try {
      const windowRange = WINDOW_DAYS[get().grain];
      const buckets = await tokenUsage(windowRange);
      set({ buckets, loaded: true, error: null });
    } catch (err) {
      set({ error: `Could not read your consumption history: ${String(err)}` });
    }
  },

  setGrain: async (grain: Grain) => {
    set({ grain });
    await get().refresh();
  },

  record: async (usage: UsageInput) => {
    try {
      await recordTokenUsage(usage);
    } catch (err) {
      set({ error: `Could not record what that turn cost: ${String(err)}` });
      return;
    }
    await get().refresh();
  },

  dismissError: () => set({ error: null }),
}));

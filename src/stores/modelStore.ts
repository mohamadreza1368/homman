import { create } from "zustand";

import type { AiProvider, ModelInfo } from "@/lib/schemas";
import { chatPreferences, rememberModel } from "@/stores/chatPreferences";

/**
 * AI model discovery, validation and catalog management for HOOMAAN.
 *
 * Verifies credentials dynamically against configured provider endpoints.
 * User model preferences are cached across sessions while live catalogues are fetched fresh.
 */
export type KeyStatus = "unknown" | "checking" | "valid" | "invalid" | "error";

interface ProviderCatalogState {
  models: ModelInfo[];
  selected: string | null;
  status: KeyStatus;
  message?: string;
  requestId?: string;
}

const DEFAULT_PROVIDER_STATE: ProviderCatalogState = {
  models: [],
  selected: null,
  status: "unknown",
};

function createInitialProviderState(provider: AiProvider): ProviderCatalogState {
  return {
    ...DEFAULT_PROVIDER_STATE,
    selected: chatPreferences().model[provider] ?? null,
  };
}

export function restoredCatalogue(): Partial<Record<AiProvider, ProviderCatalogState>> {
  const initial: Partial<Record<AiProvider, ProviderCatalogState>> = {};
  const knownProviders = Object.keys(chatPreferences().model) as AiProvider[];
  for (const provider of knownProviders) {
    initial[provider] = createInitialProviderState(provider);
  }
  return initial;
}

interface ModelStoreState {
  byProvider: Partial<Record<AiProvider, ProviderCatalogState>>;

  get: (provider: AiProvider) => ProviderCatalogState;
  beginCheck: (provider: AiProvider, requestId: string) => void;
  receiveModels: (provider: AiProvider, requestId: string, models: ModelInfo[]) => void;
  failCheck: (requestId: string, code: string, message: string) => void;
  select: (provider: AiProvider, modelId: string) => void;
  reset: (provider: AiProvider) => void;
  providerFor: (requestId: string) => AiProvider | null;
}

export const useModelStore = create<ModelStoreState>()((set, get) => ({
  byProvider: restoredCatalogue(),

  get: (provider: AiProvider) => get().byProvider[provider] ?? DEFAULT_PROVIDER_STATE,

  beginCheck: (provider: AiProvider, requestId: string) =>
    set((state) => ({
      byProvider: {
        ...state.byProvider,
        [provider]: {
          ...(state.byProvider[provider] ?? DEFAULT_PROVIDER_STATE),
          status: "checking",
          requestId,
          message: undefined,
        },
      },
    })),

  receiveModels: (provider: AiProvider, requestId: string, models: ModelInfo[]) =>
    set((state) => {
      const current = state.byProvider[provider] ?? DEFAULT_PROVIDER_STATE;
      if (current.requestId && current.requestId !== requestId) {
        return state;
      }

      const recommended = models.find((m) => m.recommended)?.id ?? null;
      const keepSelection =
        current.selected && models.some((m) => m.id === current.selected)
          ? current.selected
          : recommended;

      return {
        byProvider: {
          ...state.byProvider,
          [provider]: {
            models,
            selected: keepSelection,
            status: "valid",
            requestId: undefined,
          },
        },
      };
    }),

  failCheck: (requestId: string, code: string, message: string) =>
    set((state) => {
      const match = Object.entries(state.byProvider).find(
        ([, val]) => val?.requestId === requestId,
      );
      if (!match) return state;

      const [provider, current] = match as [AiProvider, ProviderCatalogState];
      return {
        byProvider: {
          ...state.byProvider,
          [provider]: {
            ...current,
            status: code === "invalid_api_key" ? "invalid" : "error",
            message,
            requestId: undefined,
          },
        },
      };
    }),

  select: (provider: AiProvider, modelId: string) => {
    rememberModel(provider, modelId);
    set((state) => ({
      byProvider: {
        ...state.byProvider,
        [provider]: {
          ...(state.byProvider[provider] ?? DEFAULT_PROVIDER_STATE),
          selected: modelId,
        },
      },
    }));
  },

  reset: (provider: AiProvider) =>
    set((state) => ({
      byProvider: {
        ...state.byProvider,
        [provider]: createInitialProviderState(provider),
      },
    })),

  providerFor: (requestId: string) => {
    const match = Object.entries(get().byProvider).find(
      ([, val]) => val?.requestId === requestId,
    );
    return match ? (match[0] as AiProvider) : null;
  },
}));

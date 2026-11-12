import { create } from "zustand";

const STORAGE_KEY = "hoomaan.customApi.v1";

export interface CustomApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface CustomApiState extends CustomApiConfig {
  models: string[];
  setConfig: (patch: Partial<CustomApiConfig>) => void;
  setModels: (models: string[]) => void;
  clearConfig: () => void;
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.replace(/\/chat\/completions$/i, "").replace(/\/models$/i, "");
}

export function isCustomApiConfigured(config: Pick<CustomApiConfig, "baseUrl" | "model">): boolean {
  return Boolean(normalizeBaseUrl(config.baseUrl) && config.model.trim());
}

function readStoredConfig(): CustomApiConfig {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { baseUrl: "", apiKey: "", model: "" };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { baseUrl: "", apiKey: "", model: "" };
    const parsed = JSON.parse(raw) as Partial<CustomApiConfig>;
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
    };
  } catch {
    return { baseUrl: "", apiKey: "", model: "" };
  }
}

function writeStoredConfig(config: CustomApiConfig): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Keep config in memory when storage is unavailable.
  }
}

const initial = readStoredConfig();

export const useCustomApiConfig = create<CustomApiState>((set, get) => ({
  baseUrl: initial.baseUrl,
  apiKey: initial.apiKey,
  model: initial.model,
  models: [],
  setConfig: (patch) => {
    const next: CustomApiConfig = {
      baseUrl: patch.baseUrl !== undefined ? patch.baseUrl : get().baseUrl,
      apiKey: patch.apiKey !== undefined ? patch.apiKey : get().apiKey,
      model: patch.model !== undefined ? patch.model : get().model,
    };
    writeStoredConfig(next);
    set(next);
  },
  setModels: (models) => set({ models }),
  clearConfig: () => {
    const empty: CustomApiConfig = { baseUrl: "", apiKey: "", model: "" };
    writeStoredConfig(empty);
    set({ ...empty, models: [] });
  },
}));

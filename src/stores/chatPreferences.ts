import {
  AiProviderSchema,
  LanguageSchema,
  UserProfileSchema,
  type AiProvider,
  type Language,
  type UserProfile,
} from "@/lib/schemas";

import { MAX_SPOKEN_CHARS } from "@/features/chat/speakableText";
import {
  VOICE_MAX_SPEED,
  VOICE_MAX_VOLUME,
  VOICE_MIN_SPEED,
  VOICE_MIN_VOLUME,
} from "@/features/chat/speech";
import { readLocal, writeLocal } from "@/lib/localStore";

/**
 * Persistent assistant and clinical AI preferences for HOOMAAN.
 *
 * Persists provider selection, audience profile, speech parameters, and preferred model mappings.
 * Credential keys are strictly isolated in system keyrings and never stored in this preferences file.
 */
const CHAT_PREFERENCES_KEY = "hoomaan.chat.v1";

export interface ChatPreferences {
  provider: AiProvider;
  profile: UserProfile;
  language: Language;
  model: Partial<Record<AiProvider, string>>;
  settingsOpen: boolean;
  spokenLimit: number;
  spokenSpeed: number;
  spokenVolume: number;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  provider: "google",
  profile: "student",
  language: "bg",
  model: {},
  settingsOpen: false,
  spokenLimit: 0,
  spokenSpeed: 1.0,
  spokenVolume: 1.0,
};

function clampRange(val: unknown, min: number, max: number): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  return Math.min(Math.max(val, min), max);
}

export function sanitiseChatPreferences(raw: unknown): Partial<ChatPreferences> {
  if (typeof raw !== "object" || raw === null) return {};

  const record = raw as Record<string, unknown>;
  const clean: Partial<ChatPreferences> = {};

  const providerCheck = AiProviderSchema.safeParse(record.provider);
  if (providerCheck.success) clean.provider = providerCheck.data;

  const profileCheck = UserProfileSchema.safeParse(record.profile);
  if (profileCheck.success) clean.profile = profileCheck.data;

  const languageCheck = LanguageSchema.safeParse(record.language);
  if (languageCheck.success) clean.language = languageCheck.data;

  if (typeof record.settingsOpen === "boolean") {
    clean.settingsOpen = record.settingsOpen;
  }

  if (typeof record.model === "object" && record.model !== null) {
    const models: Partial<Record<AiProvider, string>> = {};
    for (const [key, val] of Object.entries(record.model)) {
      const parsedProvider = AiProviderSchema.safeParse(key);
      if (parsedProvider.success && typeof val === "string" && val.trim().length > 0) {
        models[parsedProvider.data] = val;
      }
    }
    clean.model = models;
  }

  if (
    typeof record.spokenLimit === "number" &&
    Number.isFinite(record.spokenLimit) &&
    record.spokenLimit >= 0
  ) {
    clean.spokenLimit = Math.min(Math.round(record.spokenLimit), MAX_SPOKEN_CHARS);
  }

  const speed = clampRange(record.spokenSpeed, VOICE_MIN_SPEED, VOICE_MAX_SPEED);
  if (speed !== null) clean.spokenSpeed = speed;

  const volume = clampRange(record.spokenVolume, VOICE_MIN_VOLUME, VOICE_MAX_VOLUME);
  if (volume !== null) clean.spokenVolume = volume;

  return clean;
}

export function readStoredChat(): unknown {
  try {
    const raw = readLocal(CHAT_PREFERENCES_KEY);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let activePreferences: ChatPreferences = {
  ...DEFAULT_CHAT_PREFERENCES,
  ...sanitiseChatPreferences(readStoredChat()),
};

export function chatPreferences(): ChatPreferences {
  return activePreferences;
}

export function patchChatPreferences(change: Partial<ChatPreferences>): void {
  activePreferences = { ...activePreferences, ...change };
  try {
    writeLocal(CHAT_PREFERENCES_KEY, JSON.stringify(activePreferences));
  } catch {
    // Gracefully handle storage errors
  }
}

export function rememberModel(provider: AiProvider, modelId: string): void {
  patchChatPreferences({
    model: { ...activePreferences.model, [provider]: modelId },
  });
}

export function reloadChatPreferences(): void {
  activePreferences = {
    ...DEFAULT_CHAT_PREFERENCES,
    ...sanitiseChatPreferences(readStoredChat()),
  };
}

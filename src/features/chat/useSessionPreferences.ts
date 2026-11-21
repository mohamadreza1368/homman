import { useEffect, useState } from "react";
import type { AiProvider, Language, UserProfile } from "@/lib/schemas";
import { chatPreferences, patchChatPreferences } from "@/stores/chatPreferences";

export function useSessionPreferences() {
  const initial = chatPreferences();
  const [provider, setProvider] = useState<AiProvider>(initial.provider);
  const [profile, setProfile] = useState<UserProfile>(initial.profile);
  const [language, setLanguage] = useState<Language>(initial.language);
  const [spokenLimit, setSpokenLimit] = useState(initial.spokenLimit);
  const [spokenSpeed, setSpokenSpeed] = useState(initial.spokenSpeed);
  const [spokenVolume, setSpokenVolume] = useState(initial.spokenVolume);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    patchChatPreferences({
      provider,
      profile,
      language,
      spokenLimit,
      spokenSpeed,
      spokenVolume,
    });
  }, [provider, profile, language, spokenLimit, spokenSpeed, spokenVolume]);

  return {
    provider,
    setProvider,
    profile,
    setProfile,
    language,
    setLanguage,
    spokenLimit,
    setSpokenLimit,
    spokenSpeed,
    setSpokenSpeed,
    spokenVolume,
    setSpokenVolume,
    selectedModel,
    setSelectedModel,
  };
}

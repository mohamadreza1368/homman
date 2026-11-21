import { useState } from "react";

import type { AiProvider, Language, UserProfile } from "@/lib/schemas";
import { chatPreferences, patchChatPreferences } from "@/stores/chatPreferences";
import {
  isCustomApiConfigured,
  useCustomApiConfig,
} from "@/stores/customApiConfig";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import { BridgeSettings } from "./BridgeSettings";
import { DisplaySettings } from "./DisplaySettings";
import { VoiceSettings } from "./VoiceSettings";
import { CustomApiConfigSection } from "./CustomApiConfigSection";
import { ProfileLanguageControls } from "./ProfileLanguageControls";

interface SettingsDrawerProps {
  provider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  spokenLimit: number;
  onSpokenLimitChange: (limit: number) => void;
  spokenSpeed: number;
  onSpokenSpeedChange: (speed: number) => void;
  spokenVolume: number;
  onSpokenVolumeChange: (volume: number) => void;
}

/**
 * Assistant configuration drawer — Custom OpenAI-compatible API only.
 */
export function SettingsDrawer({
  profile,
  onProfileChange,
  language,
  onLanguageChange,
  spokenLimit,
  onSpokenLimitChange,
  spokenSpeed,
  onSpokenSpeedChange,
  spokenVolume,
  onSpokenVolumeChange,
}: SettingsDrawerProps) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");

  const baseUrl = useCustomApiConfig((s) => s.baseUrl);
  const model = useCustomApiConfig((s) => s.model);

  const configured = isCustomApiConfigured({ baseUrl, model });

  const [open, setOpen] = useState(
    () => chatPreferences().settingsOpen || !configured,
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <div dir={fa ? "rtl" : "ltr"} className="border-b border-slate-800 text-xs">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex items-center gap-1.5 rounded border border-teal-600/60 bg-teal-500/10 px-2 py-1 text-[11px] font-medium text-teal-300">
          <span>Custom API</span>
          <span
            className={configured ? "text-emerald-400" : "text-amber-400"}
            title={
              configured
                ? fa
                  ? "Custom API آماده است"
                  : "Custom API configured"
                : fa
                  ? "نیازمند تنظیم"
                  : "Not configured"
            }
          >
            ●
          </span>
        </span>

        {configured && (
          <span dir="ltr" className="min-w-0 truncate text-[10px] text-slate-500">
            {model}
          </span>
        )}

        <button
          type="button"
          onClick={() =>
            setOpen((value) => {
              patchChatPreferences({ settingsOpen: !value });
              return !value;
            })
          }
          className="ms-auto shrink-0 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-600 hover:text-slate-200"
          aria-expanded={open}
        >
          {open ? (fa ? "بستن" : "Hide") : fa ? "تنظیمات API" : "Settings"}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-800/60 px-3 py-3">
          <CustomApiConfigSection onError={setError} />

          <ProfileLanguageControls
            profile={profile}
            onProfileChange={onProfileChange}
            language={language}
            onLanguageChange={onLanguageChange}
          />

          <VoiceSettings
            language={language}
            spokenLimit={spokenLimit}
            onSpokenLimitChange={onSpokenLimitChange}
            spokenSpeed={spokenSpeed}
            onSpokenSpeedChange={onSpokenSpeedChange}
            spokenVolume={spokenVolume}
            onSpokenVolumeChange={onSpokenVolumeChange}
          />

          <DisplaySettings />
          <BridgeSettings />

          {error && (
            <p className="rounded border border-rose-800/60 bg-rose-900/20 px-2 py-1 text-[10px] text-rose-300">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

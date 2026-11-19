import { useState, type ReactNode } from "react";

import type { Language } from "@/lib/schemas";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import {
  speakableLanguages,
  voicesForLanguage,
  VOICE_MAX_SPEED,
  VOICE_MAX_VOLUME,
  VOICE_MIN_SPEED,
  VOICE_MIN_VOLUME,
} from "./speech";
import { useLocalVoices } from "./useLocalVoices";

const SPOKEN_LENGTH_LIMITS = [
  {
    id: 0,
    label: "Whole answer",
    labelFa: "کل پاسخ",
    title: "Speak all of it (recommended)",
  },
  {
    id: 700,
    label: "~1 para",
    labelFa: "حدود ۱ بند",
    title: "Speak roughly the first paragraph",
  },
  {
    id: 1600,
    label: "~2 paras",
    labelFa: "حدود ۲ بند",
    title: "Speak roughly the first two paragraphs",
  },
] as const;

const PACE_PRESET_OPTIONS = [
  { value: 0.8, label: "Slower", labelFa: "آهسته", title: "For following a second language" },
  { value: 1.0, label: "Normal", labelFa: "عادی", title: "The voice's natural pace" },
  { value: 1.25, label: "Faster", labelFa: "سریع", title: "For revising something already known" },
] as const;

function formatPaceMultiplier(num: number): string {
  return `${Number(num.toFixed(2))}×`;
}

const LOCALE_DISPLAY_NAMES: Record<Language, string> = {
  auto: "English",
  en: "English",
  es: "Spanish",
  bg: "Bulgarian",
};

function MissingVoiceNotice({ language }: { language: Language }) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const installedVoices = useLocalVoices();
  const langTitle = LOCALE_DISPLAY_NAMES[language];

  if (installedVoices.length === 0) return null;
  if (voicesForLanguage(installedVoices, language).length > 0) return null;

  const alternateLanguages = language === "auto" ? speakableLanguages(installedVoices) : [];
  if (alternateLanguages.length > 0) {
    return (
      <SettingsNoticeBox>
        {isPersian
          ? "پاسخ‌ها به زبان نوشته‌شده خوانده می‌شوند، اما صدای انگلیسی روی این سیستم در دسترس نیست."
          : `Answers are read in whichever language they are written in. This app can speak ${formatLanguageList(
              alternateLanguages
            )} here, but no English voice is available to it, so English answers cannot be read aloud.`}
      </SettingsNoticeBox>
    );
  }

  const isWindowsEnvironment =
    typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

  return (
    <SettingsNoticeBox>
      {isPersian
        ? `هیچ صدای گفتاری برای ${langTitle} روی این مرورگر یا سیستم در دسترس نیست.`
        : `No ${langTitle} voice is available to this app here, so answers cannot be read aloud in it. ${
            isWindowsEnvironment
              ? "Windows adds voices under Settings → Time & language → Speech."
              : "The browser engine on this system offers none it can use, and installing system voices may not change that."
          }`}
    </SettingsNoticeBox>
  );
}

function SettingsNoticeBox({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 rounded border border-slate-700/70 bg-slate-800/40 px-2 py-1 text-[10px] leading-snug text-slate-400">
      {children}
    </p>
  );
}

function formatLanguageList(languages: Exclude<Language, "auto">[]): string {
  const titles = languages.map((l) => LOCALE_DISPLAY_NAMES[l]);
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
}

interface VoiceSettingsProps {
  language: Language;
  spokenLimit: number;
  onSpokenLimitChange: (limit: number) => void;
  spokenSpeed: number;
  onSpokenSpeedChange: (speed: number) => void;
  spokenVolume: number;
  onSpokenVolumeChange: (volume: number) => void;
}

export function VoiceSettings({
  language,
  spokenLimit,
  onSpokenLimitChange,
  spokenSpeed,
  onSpokenSpeedChange,
  spokenVolume,
  onSpokenVolumeChange,
}: VoiceSettingsProps) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          {isPersian ? "خواندن صوتی پاسخ" : "Read aloud"}
        </p>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="ms-auto text-[10px] text-slate-500 underline decoration-dotted hover:text-slate-300"
        >
          {isExpanded
            ? isPersian
              ? "گزینه‌های کمتر"
              : "Fewer options"
            : isPersian
              ? "گزینه‌های بیشتر"
              : "More options"}
        </button>
      </div>

      <MissingVoiceNotice language={language} />

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={VOICE_MIN_SPEED}
          max={VOICE_MAX_SPEED}
          step={0.05}
          value={spokenSpeed}
          onChange={(e) => onSpokenSpeedChange(Number(e.target.value))}
          aria-label={isPersian ? "سرعت خواندن" : "Speaking speed"}
          aria-valuetext={`${formatPaceMultiplier(spokenSpeed)} speed`}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-500"
        />
        <span dir="ltr" className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-300">
          {formatPaceMultiplier(spokenSpeed)}
        </span>
      </div>

      <div className="mt-1.5 flex gap-1">
        {PACE_PRESET_OPTIONS.map(({ value, label, labelFa, title }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSpokenSpeedChange(value)}
            title={title}
            aria-pressed={spokenSpeed === value}
            className={`flex-1 rounded border px-1.5 py-1 text-[11px] transition-colors ${
              spokenSpeed === value
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-slate-700 text-slate-400"
            }`}
          >
            {isPersian ? labelFa : label}
          </button>
        ))}
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3 rounded border border-slate-800/80 bg-slate-950/40 px-2 py-2">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {isPersian ? "بلندی صدا" : "Volume"}
              </p>
              <span className="ms-auto text-[10px] tabular-nums text-slate-500">
                {Math.round(spokenVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={VOICE_MIN_VOLUME}
              max={VOICE_MAX_VOLUME}
              step={0.05}
              value={spokenVolume}
              onChange={(e) => onSpokenVolumeChange(Number(e.target.value))}
              aria-label={isPersian ? "بلندی صدا" : "Speaking volume"}
              aria-valuetext={`${Math.round(spokenVolume * 100)} percent`}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-500"
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
              {isPersian ? "مقدار متن خوانده‌شده" : "How much is spoken"}
            </p>
            <div className="flex gap-1">
              {SPOKEN_LENGTH_LIMITS.map(({ id, label, labelFa, title }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSpokenLimitChange(id)}
                  title={title}
                  aria-pressed={spokenLimit === id}
                  className={`flex-1 rounded border px-1.5 py-1 text-[11px] transition-colors ${
                    spokenLimit === id
                      ? "border-sky-500 bg-sky-500/10 text-sky-300"
                      : "border-slate-700 text-slate-400"
                  }`}
                >
                  {isPersian ? labelFa : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

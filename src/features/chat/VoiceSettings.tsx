import { useState } from "react";

import { type Language } from "@/lib/schemas";
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

const SPOKEN_LIMITS = [
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

const SPEED_PRESETS = [
  { value: 0.8, label: "Slower", labelFa: "آهسته", title: "For following a second language" },
  { value: 1.0, label: "Normal", labelFa: "عادی", title: "The voice's natural pace" },
  { value: 1.25, label: "Faster", labelFa: "سریع", title: "For revising something already known" },
] as const;

function formatMultiplier(value: number): string {
  return `${Number(value.toFixed(2))}×`;
}

const LANGUAGE_NAMES: Record<Language, string> = {
  auto: "English",
  en: "English",
  es: "Spanish",
  bg: "Bulgarian",
};

function MissingVoiceNotice({ language }: { language: Language }) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const voices = useLocalVoices();
  const name = LANGUAGE_NAMES[language];

  if (voices.length === 0) return null;
  if (voicesForLanguage(voices, language).length > 0) return null;

  const alternatives = language === "auto" ? speakableLanguages(voices) : [];
  if (alternatives.length > 0) {
    return (
      <Notice>
        {fa
          ? `پاسخ‌ها به زبان نوشته‌شده خوانده می‌شوند، اما صدای انگلیسی روی این سیستم در دسترس نیست.`
          : `Answers are read in whichever language they are written in. This app can speak ${listLanguages(alternatives)} here, but no English voice is available to it, so English answers cannot be read aloud.`}
      </Notice>
    );
  }

  const windows = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");

  return (
    <Notice>
      {fa
        ? `هیچ صدای گفتاری برای ${name} روی این مرورگر یا سیستم در دسترس نیست.`
        : `No ${name} voice is available to this app here, so answers cannot be read aloud in it. ${
            windows
              ? "Windows adds voices under Settings → Time & language → Speech."
              : "The browser engine on this system offers none it can use, and installing system voices may not change that."
          }`}
    </Notice>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 rounded border border-slate-700/70 bg-slate-800/40 px-2 py-1 text-[10px] leading-snug text-slate-400">
      {children}
    </p>
  );
}

function listLanguages(languages: Exclude<Language, "auto">[]): string {
  const names = languages.map((language) => LANGUAGE_NAMES[language]);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

interface Props {
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
}: Props) {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          {fa ? "خواندن صوتی پاسخ" : "Read aloud"}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="ms-auto text-[10px] text-slate-500 underline decoration-dotted hover:text-slate-300"
        >
          {expanded
            ? fa
              ? "گزینه‌های کمتر"
              : "Fewer options"
            : fa
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
          onChange={(event) => onSpokenSpeedChange(Number(event.target.value))}
          aria-label={fa ? "سرعت خواندن" : "Speaking speed"}
          aria-valuetext={`${formatMultiplier(spokenSpeed)} speed`}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-500"
        />
        <span dir="ltr" className="w-10 shrink-0 text-right text-[11px] tabular-nums text-slate-300">
          {formatMultiplier(spokenSpeed)}
        </span>
      </div>

      <div className="mt-1.5 flex gap-1">
        {SPEED_PRESETS.map(({ value, label, labelFa, title }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSpokenSpeedChange(value)}
            title={title}
            aria-pressed={spokenSpeed === value}
            className={`flex-1 rounded border px-1.5 py-1 text-[11px] ${
              spokenSpeed === value
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-slate-700 text-slate-400"
            }`}
          >
            {fa ? labelFa : label}
          </button>
        ))}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 rounded border border-slate-800/80 bg-slate-950/40 px-2 py-2">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {fa ? "بلندی صدا" : "Volume"}
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
              onChange={(event) => onSpokenVolumeChange(Number(event.target.value))}
              aria-label={fa ? "بلندی صدا" : "Speaking volume"}
              aria-valuetext={`${Math.round(spokenVolume * 100)} percent`}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-500"
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
              {fa ? "مقدار متن خوانده‌شده" : "How much is spoken"}
            </p>
            <div className="flex gap-1">
              {SPOKEN_LIMITS.map(({ id, label, labelFa, title }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSpokenLimitChange(id)}
                  title={title}
                  aria-pressed={spokenLimit === id}
                  className={`flex-1 rounded border px-1.5 py-1 text-[11px] ${
                    spokenLimit === id
                      ? "border-sky-500 bg-sky-500/10 text-sky-300"
                      : "border-slate-700 text-slate-400"
                  }`}
                >
                  {fa ? labelFa : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

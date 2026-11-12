import { useState } from "react";

import type { AiProvider, Language, UserProfile } from "@/lib/schemas";
import { chatPreferences, patchChatPreferences } from "@/stores/chatPreferences";
import {
  isCustomApiConfigured,
  normalizeBaseUrl,
  useCustomApiConfig,
} from "@/stores/customApiConfig";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import { BridgeSettings } from "./BridgeSettings";
import { fetchCustomModels } from "./customApiClient";
import { DisplaySettings } from "./DisplaySettings";
import { VoiceSettings } from "./VoiceSettings";

const PROFILES: { id: UserProfile; label: string; labelFa: string }[] = [
  { id: "layperson", label: "General", labelFa: "عمومی" },
  { id: "student", label: "Student", labelFa: "دانشجو" },
  { id: "clinician", label: "Professional", labelFa: "حرفه‌ای" },
];

const LANGUAGES: { id: Language; label: string; labelFa: string; title: string }[] = [
  {
    id: "auto",
    label: "Auto",
    labelFa: "خودکار (هم‌زبان پیام)",
    title: "پاسخ به همان زبانی که پیام می‌نویسید",
  },
  { id: "en", label: "EN", labelFa: "انگلیسی", title: "Always answer in English" },
];

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
  const apiKey = useCustomApiConfig((s) => s.apiKey);
  const model = useCustomApiConfig((s) => s.model);
  const models = useCustomApiConfig((s) => s.models);
  const setConfig = useCustomApiConfig((s) => s.setConfig);
  const setModels = useCustomApiConfig((s) => s.setModels);
  const clearConfig = useCustomApiConfig((s) => s.clearConfig);

  const configured = isCustomApiConfigured({ baseUrl, model });

  const [open, setOpen] = useState(
    () => chatPreferences().settingsOpen || !configured,
  );
  const [draftUrl, setDraftUrl] = useState(baseUrl);
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);
  const [showKey, setShowKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const cleanUrl = normalizeBaseUrl(draftUrl);
    const cleanModel = draftModel.trim();
    if (!cleanUrl) {
      setError(fa ? "آدرس Custom API را وارد کنید." : "Please enter a Custom API Base URL.");
      return;
    }
    if (!cleanModel) {
      setError(fa ? "نام مدل را وارد یا از لیست انتخاب کنید." : "Please enter or choose a model name.");
      return;
    }
    setConfig({ baseUrl: cleanUrl, apiKey: draftKey.trim(), model: cleanModel });
    setDraftUrl(cleanUrl);
    setDraftModel(cleanModel);
    setError(null);
    setStatusNote(fa ? "تنظیمات Custom API ذخیره شد." : "Custom API configuration saved.");
  }

  async function handleFetchModels() {
    const cleanUrl = normalizeBaseUrl(draftUrl);
    if (!cleanUrl) {
      setError(fa ? "ابتدا آدرس Base URL را وارد کنید." : "Enter Base URL first.");
      return;
    }
    setChecking(true);
    setError(null);
    setStatusNote(null);
    try {
      const list = await fetchCustomModels(cleanUrl, draftKey);
      setModels(list);
      const chosen = draftModel.trim() || list[0] || "";
      if (chosen) setDraftModel(chosen);
      setConfig({ baseUrl: cleanUrl, apiKey: draftKey.trim(), model: chosen });
      setStatusNote(
        fa
          ? `${list.length} مدل دریافت شد.`
          : `Loaded ${list.length} models from endpoint.`,
      );
    } catch (err) {
      setError(
        fa
          ? `خطا در دریافت لیست مدل‌ها: ${String(err)}`
          : `Failed to fetch models: ${String(err)}`,
      );
    } finally {
      setChecking(false);
    }
  }

  function handleClear() {
    clearConfig();
    setDraftUrl("");
    setDraftKey("");
    setDraftModel("");
    setStatusNote(null);
    setError(null);
  }

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
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                {fa ? "اتصال Custom API (سازگار با OpenAI)" : "Custom API (OpenAI-compatible)"}
              </p>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                  configured
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {configured
                  ? fa
                    ? "متصل"
                    : "configured"
                  : fa
                    ? "نیازمند تنظیم"
                    : "not set"}
              </span>
            </div>

            <div>
              <label
                htmlFor="custom-api-url"
                className="mb-1 block text-[10px] text-slate-400"
              >
                {fa ? "آدرس پایه (Base URL)" : "Base URL"}
              </label>
              <input
                id="custom-api-url"
                dir="ltr"
                type="url"
                value={draftUrl}
                onChange={(event) => {
                  setDraftUrl(event.target.value);
                  setError(null);
                }}
                placeholder="https://api.example.com/v1"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="custom-api-key" className="text-[10px] text-slate-400">
                  {fa ? "کلید API (API Key)" : "API Key"}
                </label>
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  {showKey ? (fa ? "مخفی" : "Hide") : fa ? "نمایش" : "Show"}
                </button>
              </div>
              <input
                id="custom-api-key"
                dir="ltr"
                type={showKey ? "text" : "password"}
                value={draftKey}
                onChange={(event) => setDraftKey(event.target.value)}
                placeholder="sk-..."
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor="custom-api-model" className="text-[10px] text-slate-400">
                  {fa ? "نام مدل" : "Model ID"}
                </label>
                <button
                  type="button"
                  disabled={checking || !draftUrl.trim()}
                  onClick={() => void handleFetchModels()}
                  className="text-[10px] text-teal-400 underline decoration-dotted hover:text-teal-300 disabled:opacity-40"
                >
                  {checking
                    ? fa
                      ? "در حال دریافت…"
                      : "Loading…"
                    : fa
                      ? "دریافت لیست مدل‌ها"
                      : "Fetch models"}
                </button>
              </div>
              <input
                id="custom-api-model"
                dir="ltr"
                type="text"
                value={draftModel}
                onChange={(event) => {
                  setDraftModel(event.target.value);
                  setError(null);
                }}
                placeholder="e.g. gpt-4o-mini / custom-model"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500"
              />
              {models.length > 0 && (
                <select
                  dir="ltr"
                  value={models.includes(draftModel) ? draftModel : ""}
                  onChange={(event) => {
                    if (event.target.value) setDraftModel(event.target.value);
                  }}
                  className="mt-1.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-teal-500"
                >
                  <option value="">
                    {fa ? "انتخاب از مدل‌های دریافت‌شده…" : "Select a fetched model…"}
                  </option>
                  {models.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded bg-teal-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-teal-500"
              >
                {fa ? "ذخیره و فعال‌سازی" : "Save & Activate"}
              </button>
              {(baseUrl || apiKey || model) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:border-slate-500 hover:text-slate-200"
                >
                  {fa ? "پاک کردن" : "Clear"}
                </button>
              )}
            </div>

            {statusNote && (
              <p className="text-[10px] text-emerald-400">{statusNote}</p>
            )}
            <p className="text-[10px] leading-snug text-slate-500">
              {fa
                ? "تنها مسیر فعال چت‌بات Custom API است و اطلاعات اتصال فقط در مرورگر/دستگاه شما ذخیره می‌شود."
                : "Only Custom API is used for chat; connection details are stored locally on your device."}
            </p>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
              {fa ? "سطح مخاطب" : "Audience"}
            </p>
            <div className="flex gap-1">
              {PROFILES.map(({ id, label, labelFa }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onProfileChange(id)}
                  className={`flex-1 rounded border px-1.5 py-1 text-[11px] ${
                    profile === id
                      ? "border-sky-500 bg-sky-500/10 text-sky-300"
                      : "border-slate-700 text-slate-400"
                  }`}
                >
                  {fa ? labelFa : label}
                </button>
              ))}
            </div>
          </div>

          <VoiceSettings
            language={language}
            spokenLimit={spokenLimit}
            onSpokenLimitChange={onSpokenLimitChange}
            spokenSpeed={spokenSpeed}
            onSpokenSpeedChange={onSpokenSpeedChange}
            spokenVolume={spokenVolume}
            onSpokenVolumeChange={onSpokenVolumeChange}
          />

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
              {fa ? "زبان پاسخ دستیار" : "Answer language"}
            </p>
            <div className="flex gap-1">
              {LANGUAGES.map(({ id, label, labelFa, title }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onLanguageChange(id)}
                  title={title}
                  aria-pressed={language === id}
                  className={`flex-1 rounded border px-1.5 py-1 text-[11px] ${
                    language === id
                      ? "border-sky-500 bg-sky-500/10 text-sky-300"
                      : "border-slate-700 text-slate-400"
                  }`}
                >
                  {fa ? labelFa : label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] leading-snug text-slate-600">
              {fa
                ? "در حالت خودکار، اگر به فارسی سؤال بپرسید دستیار به فارسی پاسخ می‌دهد."
                : "In Auto mode, the assistant answers in whatever language you write in."}
            </p>
          </div>

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

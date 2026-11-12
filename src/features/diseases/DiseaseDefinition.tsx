import { useEffect, useState } from "react";
import { streamCustomChat } from "@/features/chat/customApiClient";
import { isCustomApiConfigured, useCustomApiConfig } from "@/stores/customApiConfig";
import { persianDisease } from "./persian";

interface Definition { text: string; references: string }
interface DefinitionIndex { definitions: Record<string, Definition> }
let loaded: DefinitionIndex | undefined;
let pending: Promise<DefinitionIndex> | undefined;

function loadDefinitions(): Promise<DefinitionIndex> {
  if (loaded) return Promise.resolve(loaded);
  if (!pending) pending = fetch(`${import.meta.env.BASE_URL}diseases/definitions.json`)
    .then((r) => { if (!r.ok) throw new Error("Definitions unavailable"); return r.json() as Promise<DefinitionIndex>; })
    .then((index) => { loaded = index; return index; })
    .finally(() => { pending = undefined; });
  return pending;
}

export function DiseaseDefinition({ id, fa }: { id: string; fa: boolean }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(loaded);
  const [failed, setFailed] = useState(false);
  const [translated, setTranslated] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const config = useCustomApiConfig();
  useEffect(() => {
    if (!open || index) return;
    let active = true;
    setFailed(false);
    loadDefinitions().then((value) => { if (active) setIndex(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [open, index]);
  const definition = index?.definitions[id];
  const persian = persianDisease[id];
  async function translate() {
    if (!definition || translating) return;
    setTranslating(true);
    setTranslated("");
    setTranslationError(false);
    try {
      const result = await streamCustomChat({
        baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model,
        systemPrompt: "Translate the supplied medical ontology definition accurately into natural Persian. Preserve uncertainty, negation, and clinical meaning. Do not add diagnosis, treatment, or facts. Output only the Persian translation.",
        history: [], query: definition.text,
      });
      if (!result.text.trim()) throw new Error("Empty translation");
      setTranslated(result.text.trim());
    } catch { setTranslationError(true); }
    finally { setTranslating(false); }
  }
  return <details className="mt-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer text-xs font-medium text-teal-200 focus-visible:outline-2 focus-visible:outline-teal-300">{fa ? "توضیح بیماری" : "Disease description"}</summary>
    {open && <div className="mt-2 text-xs leading-6 text-slate-300">
      {!index && !failed && <p role="status">{fa ? "در حال بارگذاری…" : "Loading…"}</p>}
      {failed && <p role="alert">{fa ? "بارگذاری توضیح ممکن نشد؛ پنل را دوباره باز کنید." : "Could not load the description; reopen to retry."}</p>}
      {index && !definition && <p>{fa ? "در نسخهٔ منبع توضیحی برای این مورد وجود ندارد." : "No definition is available in this source release."}</p>}
      {persian && fa && <div dir="rtl"><p className="text-teal-200">خلاصهٔ فارسی آموزشی · نیازمند بازبینی تخصصی</p><p className="mt-1">{persian.summary}</p></div>}
      {definition && <>
        {fa && !persian && <div dir="rtl" className="mb-2">
          <p className="text-slate-400">خلاصهٔ فارسی آماده نیست. ترجمه با سرویس تنظیم‌شده انجام می‌شود و به بازبینی تخصصی نیاز دارد.</p>
          {isCustomApiConfigured(config) ? <button type="button" disabled={translating} onClick={() => void translate()} className="mt-2 rounded-md bg-teal-800 px-3 py-1 text-white hover:bg-teal-700 disabled:opacity-50">{translating ? "در حال ترجمه…" : "ترجمه به فارسی"}</button> : <p className="mt-1 text-amber-300">برای ترجمه، ابتدا سرویس هوش مصنوعی را در تنظیمات برنامه مشخص کنید.</p>}
          {translationError && <p role="alert" className="mt-1 text-rose-300">ترجمه انجام نشد؛ اتصال و تنظیمات سرویس را بررسی کنید.</p>}
          {translated && <div className="mt-2"><p className="text-amber-300">ترجمهٔ ماشینی · بازبینی‌نشده</p><p>{translated}</p></div>}
        </div>}
        <p className="text-slate-400">{fa ? "متن اصلی منبع:" : "Source definition (English)."}</p><p dir="ltr" className="mt-1 text-left">{definition.text}</p><p className="mt-2 text-slate-400" dir="ltr">{id.startsWith("MONDO:") ? "Mondo Disease Ontology" : "Human Disease Ontology"} · {id}</p></>}
    </div>}
  </details>;
}

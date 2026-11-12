import { useEffect, useMemo, useState } from "react";
import { DiseaseDefinition } from "./DiseaseDefinition";
import { normalisePersian, persianDisease } from "./persian";

type Entry = [id: string, label: string, ...synonyms: string[]];
type Index = { release: string; entries: Entry[] };
let cached: Index | undefined;

export function MondoSearch({ query, fa }: { query: string; fa: boolean }) {
  const [index, setIndex] = useState<Index | undefined>(cached);
  const [failed, setFailed] = useState(false);
  const needle = query.trim().toLocaleLowerCase();
  const eligible = needle.length >= 3;

  useEffect(() => {
    if (!eligible || index) return;
    const controller = new AbortController();
    setFailed(false);
    fetch(`${import.meta.env.BASE_URL}diseases/mondo-index.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load Mondo index");
        return response.json() as Promise<Index>;
      })
      .then((data) => { cached = data; setIndex(data); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true); });
    return () => controller.abort();
  }, [eligible, index]);

  const results = useMemo(() => {
    if (!eligible || !index) return [];
    const found: Entry[] = [];
    for (const entry of index.entries) {
      if (entry.some((value) => value.toLocaleLowerCase().includes(needle)) || normalisePersian(persianDisease[entry[0]]?.name ?? "").includes(normalisePersian(needle))) found.push(entry);
      if (found.length >= 30) break;
    }
    return found;
  }, [eligible, index, needle]);

  if (!eligible) return <p className="mt-5 text-xs leading-6 text-slate-400">{fa ? "برای جست‌وجو در فهرست جهانی دست‌کم سه حرف وارد کنید؛ نام فارسی هنوز برای همهٔ بیماری‌ها موجود نیست." : "Enter at least three letters or a MONDO identifier to search the wider catalogue."}</p>;
  return <section className="mt-5 border-t border-slate-700 pt-4" aria-label={fa ? "فهرست جهانی بیماری‌ها" : "Global disease catalogue"}>
    <h3 className="text-sm font-semibold text-teal-200">{fa ? "فهرست جهانی بیماری‌ها · Mondo" : "Global disease catalogue · Mondo"}</h3>
    <p className="mt-2 text-xs leading-6 text-slate-400">{fa ? "نام‌های انگلیسی از منبع باز Mondo هستند؛ ارتباط با اندام، ترجمه و نمایش روی بدن برای این نتایج هنوز بررسی نشده است." : "English terms from Mondo; anatomical mapping, translation and visualisation have not been reviewed for these results."}</p>
    {failed && <p role="alert" className="mt-2 text-xs text-rose-300">{fa ? "بارگذاری فهرست ممکن نشد." : "Could not load the catalogue."}</p>}
    {!index && !failed && <p role="status" className="mt-2 text-xs text-slate-400">{fa ? "در حال بارگذاری…" : "Loading…"}</p>}
    {index && results.length === 0 && <p className="mt-2 text-xs text-slate-400">{fa ? "نتیجه‌ای پیدا نشد." : "No matches."}</p>}
    <ul className="mt-3 space-y-2" dir="ltr">
      {results.map(([id, label]) => <li key={id} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-left">
        {fa && persianDisease[id] && <p dir="rtl" className="mb-1 text-right text-sm font-medium text-teal-100">{persianDisease[id].name}</p>}
        <a className="text-sm text-slate-100 underline decoration-teal-700 underline-offset-4 hover:text-teal-300" href={`https://monarchinitiative.org/disease/${id}`} target="_blank" rel="noreferrer">{label}</a>
        <p className="mt-1 text-[10px] text-slate-400">{id}</p>
        <DiseaseDefinition id={id} fa={fa} />
      </li>)}
    </ul>
    {results.length === 30 && <p className="mt-2 text-xs text-slate-400">{fa ? "۳۰ نتیجهٔ اول؛ برای محدود کردن نتایج، عبارت دقیق‌تری وارد کنید." : "First 30 results; refine your search for more."}</p>}
    <p className="mt-3 text-[10px] leading-5 text-slate-400">Mondo Disease Ontology · CC BY 4.0 · {index?.release} · <a className="text-teal-300 underline" href="https://mondo.monarchinitiative.org/pages/download/" target="_blank" rel="noreferrer">Source</a></p>
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { useSceneStore } from "@/stores/sceneStore";

interface Site { uberon: string; sourceDisease: string; male: string[]; female: string[] }
interface Disease { id: string; name: string; sites: Site[] }
interface Data { diseaseOntologyVersion: string; uberonVersion: string; diseases: Disease[] }
let cache: Data | undefined;

export function OntologySites({ query, selectedOnly, fa }: { query: string; selectedOnly: boolean; fa: boolean }) {
  const [data, setData] = useState(cache);
  const [failed, setFailed] = useState(false);
  const organs = useSceneStore((s) => s.organs);
  const model = useSceneStore((s) => s.genderModel);
  const selected = useSceneStore((s) => s.selectedOrganIds);
  const apply = useSceneStore((s) => s.applyCommand);
  useEffect(() => {
    if (data) return;
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}diseases/do-sites.json`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("Unable to load disease locations"); return r.json() as Promise<Data>; })
      .then((next) => { cache = next; setData(next); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true); });
    return () => controller.abort();
  }, [data]);
  const needle = query.trim().toLocaleLowerCase();
  const matches = useMemo(() => (data?.diseases ?? []).filter((d) =>
    (!needle || d.name.toLocaleLowerCase().includes(needle) || d.id.toLocaleLowerCase().includes(needle)) &&
    (!selectedOnly || d.sites.some((site) => site[model].some((id) => selected.includes(id))))
  ), [data, needle, selectedOnly, model, selected]);

  return <section className="mt-5 border-t border-slate-700 pt-4" aria-label={fa ? "ارتباط‌های آناتومی" : "Anatomical associations"}>
    <h3 className="text-sm font-semibold text-teal-200">{fa ? "بیماری‌های مرتبط با ساختار بدن" : "Diseases associated with anatomy"}</h3>
    <p className="mt-2 text-xs leading-6 text-slate-400">{fa ? "منبع محل: Disease Ontology و Uberon. تطبیق نام ساختار با مدل خودکار است و به بازبینی تخصصی نیاز دارد. مکان بیماری برای هر فرد و سمت درگیر ممکن است متفاوت باشد." : "Locations from Disease Ontology and Uberon. Atlas matches are automatic and require expert review; location and laterality vary by patient."}</p>
    {failed && <p role="alert" className="mt-2 text-xs text-rose-300">{fa ? "بارگذاری ارتباط‌ها ناموفق بود." : "Could not load associations."}</p>}
    {!data && !failed && <p role="status" className="mt-2 text-xs text-slate-400">{fa ? "در حال بارگذاری…" : "Loading…"}</p>}
    {data && <p className="mt-2 text-xs text-slate-400">{fa ? `${matches.length} نتیجه · جست‌وجو با نام انگلیسی یا شناسهٔ DOID` : `${matches.length} results · search English name or DOID`}</p>}
    <ul className="mt-3 space-y-2">
      {matches.slice(0, 40).map((d) => <li key={d.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
        <a dir="ltr" className="block text-left text-sm text-slate-100 underline decoration-teal-700" href={`https://disease-ontology.org/term/${d.id}/`} target="_blank" rel="noreferrer">{d.name}</a>
        <div dir="ltr" className="mt-1 text-left text-[10px] text-slate-400">{d.id}</div>
        {d.sites.map((site) => <div key={`${site.uberon}-${site.sourceDisease}`} className="mt-2 rounded-lg bg-slate-950/70 p-2">
          <div className="text-[10px] leading-5 text-slate-400" dir="ltr">{site.uberon} · {site.sourceDisease === d.id ? (fa ? "ارتباط مستقیم" : "direct") : (fa ? `از ردهٔ ${site.sourceDisease}` : `inherited from ${site.sourceDisease}`)}</div>
          {site[model].filter((id) => organs[id]).map((id) => <button key={id} type="button" onClick={() => {
            const organ = organs[id]!;
            apply({ action: "set_layer_visibility", system: organ.system, visible: true });
            apply({ action: "focus_organ", organ_id: id });
          }} className="mt-1 block w-full rounded-md bg-teal-400/10 px-2 py-1.5 text-start text-xs text-teal-200 hover:bg-teal-400/20 focus-visible:outline-2 focus-visible:outline-teal-300">{fa ? "نمایش: " : "Show: "}{organs[id]!.name_en}</button>)}
          {!site[model].some((id) => organs[id]) && <p className="mt-1 text-xs text-amber-300">{fa ? "برای این مدل تطبیقی ثبت نشده است." : "No match for this body model."}</p>}
        </div>)}
      </li>)}
    </ul>
    {matches.length > 40 && <p className="mt-2 text-xs text-slate-400">{fa ? "۴۰ نتیجهٔ اول؛ جست‌وجو را دقیق‌تر کنید." : "First 40 results; refine your search."}</p>}
    <p className="mt-3 text-[10px] leading-5 text-slate-400"><a href="https://disease-ontology.org/" target="_blank" rel="noreferrer" className="text-teal-300 underline">Disease Ontology (CC0)</a> · <a href="https://obophenotype.github.io/uberon/" target="_blank" rel="noreferrer" className="text-teal-300 underline">Uberon (CC BY 3.0)</a></p>
  </section>;
}

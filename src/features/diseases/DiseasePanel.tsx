import { useState } from "react";
import { Search, Stethoscope, ArrowUpRight, MapPin } from "lucide-react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { diseasesForStructure, searchDiseases } from "./catalog";
import { MondoSearch } from "./MondoSearch";
import { OntologySites } from "./OntologySites";

export function DiseasePanel() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const model = useSceneStore((s) => s.genderModel);
  const organs = useSceneStore((s) => s.organs);
  const selected = useSceneStore((s) => s.selectedOrganIds);
  const apply = useSceneStore((s) => s.applyCommand);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const matches = searchDiseases(query);
  const related = new Set(selected.flatMap((id) => diseasesForStructure(id, model).map((d) => d.id)));
  const shown = selectedOnly ? matches.filter((d) => related.has(d.id)) : matches;

  return <section className="h-full overflow-y-auto px-4 py-5 text-slate-200" aria-label={fa ? "کتابخانه بیماری‌ها" : "Disease library"}>
    <div className="rounded-2xl border border-teal-400/20 bg-gradient-to-br from-teal-950/80 via-slate-900 to-slate-950 p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300"><Stethoscope size={18} aria-hidden="true" /></div>
      <p className="text-[10px] font-semibold tracking-widest text-teal-300">HOMMAN · {fa ? "دانش بدن" : "BODY KNOWLEDGE"}</p>
      <h2 className="mt-2 text-lg font-bold text-white">{fa ? "بیماری‌ها و بدن" : "Disease & the body"}</h2>
      <p className="mt-2 text-xs leading-6 text-slate-300">{fa ? "بیماری را جست‌وجو کنید و ارتباط آن را با ساختارهای بدن ببینید." : "Explore conditions and their relationship to anatomical structures."}</p>
    </div>
    <label className="relative mt-4 block">
      <span className="sr-only">{fa ? "جست‌وجوی بیماری" : "Search diseases"}</span>
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-3 text-slate-400" style={fa ? { right: 12 } : { left: 12 }} />
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={fa ? "نام بیماری یا اندام…" : "Search disease or organ…"} className={`w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30 ${fa ? "pr-10 pl-3" : "pl-10 pr-3"}`} />
    </label>
    <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={selectedOnly} onChange={(e) => setSelectedOnly(e.target.checked)} className="accent-teal-400" />{fa ? "فقط مرتبط با انتخاب من" : "Related to my selection"}</label>
    <p className="mt-4 text-xs leading-5 text-slate-400" role="status">{fa ? `${shown.length} بیماری · اطلاعات آموزشی اولیه؛ پوشش کامل نیست و محتوا به بازبینی تخصصی نیاز دارد.` : `${shown.length} conditions · Early educational content; coverage is incomplete and requires clinical review.`}</p>
    <div className="mt-4 space-y-3">
      {shown.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-4 text-xs leading-6 text-slate-400">{fa ? "موردی پیدا نشد. انتخاب فعلی یا عبارت جست‌وجو را تغییر دهید." : "No matches. Try another search or selection."}</p>}
      {shown.map((d) => <article key={d.id} className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
        <h3 className="font-semibold text-slate-100">{fa ? d.name.fa : d.name.en}</h3>
        <p className="mt-1 text-xs text-slate-400" dir="ltr">{fa ? d.name.en : d.name.fa}</p>
        <p className="mt-3 text-xs leading-6 text-slate-300">{fa ? d.summary.fa : d.summary.en}</p>
        <p className="mt-2 text-xs leading-6 text-slate-300">{fa ? d.effect.fa : d.effect.en}</p>
        <div className="mt-4 space-y-2">
          {d.sites.map((site) => {
            const ids = site[model].filter((id) => organs[id]);
            return <div key={site.en} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/70 p-2.5">
              <span className="flex items-center gap-1.5 text-xs"><MapPin size={14} className="text-teal-300" aria-hidden="true" />{fa ? site.fa : site.en}</span>
              {ids.length ? <button type="button" aria-label={fa ? `نمایش ${site.fa} در مدل` : `Show ${site.en} on model`} onClick={() => {
                const organ = organs[ids[0]!]!;
                apply({ action: "set_layer_visibility", system: organ.system, visible: true });
                apply({ action: "focus_organ", organ_id: organ.organ_id });
              }} className="rounded-md bg-teal-400/15 px-2 py-1 text-xs font-medium text-teal-200 hover:bg-teal-400/25 focus-visible:outline-2 focus-visible:outline-teal-300">{fa ? "نمایش" : "Show"}</button> : <span className="text-[10px] text-amber-300">{fa ? "مدل موجود نیست" : "Not mapped"}</span>}
            </div>;
          })}
        </div>
        <a href={d.source} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-teal-300 underline underline-offset-4">{fa ? "منبع علمی" : "Source"}<ArrowUpRight size={13} aria-hidden="true" /></a>
      </article>)}
    </div>
    <p className="mt-5 text-xs leading-6 text-slate-400">{fa ? "نمایش، محل ساختار مرتبط را نشان می‌دهد و محل یا شکل واقعی ضایعه را مشخص نمی‌کند." : "The viewer locates the related structure; it does not show the actual location or shape of a lesion."}</p>
    <OntologySites query={query} selectedOnly={selectedOnly} fa={fa} />
    {!selectedOnly && <MondoSearch query={query} fa={fa} />}
  </section>;
}

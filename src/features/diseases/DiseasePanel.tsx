import { useEffect, useState } from "react";
import { Search, Stethoscope, ArrowUpRight, MapPin, AlertCircle, BookOpen } from "lucide-react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { diseasesForStructure, searchDiseases, type Disease } from "./catalog";
import { MondoSearch } from "./MondoSearch";
import { OntologySites } from "./OntologySites";

const CATEGORY_STYLES: Record<
  Disease["category"],
  { fa: string; en: string; badgeClass: string }
> = {
  cardiovascular: {
    fa: "قلبی — عروقی",
    en: "Cardiovascular",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  respiratory: {
    fa: "دستگاه تنفس",
    en: "Respiratory",
    badgeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  },
  digestive: {
    fa: "دستگاه گوارش",
    en: "Digestive & Hepatobiliary",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  renal: {
    fa: "کلیه و مجاری ادرار",
    en: "Renal & Urinary",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  nervous: {
    fa: "مغز و دستگاه عصبی",
    en: "Neurological & CNS",
    badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  endocrine: {
    fa: "غدد درون‌ریز",
    en: "Endocrine & Metabolic",
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
  skeletal: {
    fa: "اسکلتی — عضلانی",
    en: "Musculoskeletal",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  reproductive: {
    fa: "دستگاه تناسلی",
    en: "Reproductive System",
    badgeClass: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  },
};

export function DiseasePanel() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const model = useSceneStore((s) => s.genderModel);
  const organs = useSceneStore((s) => s.organs);
  const selected = useSceneStore((s) => s.selectedOrganIds);
  const apply = useSceneStore((s) => s.applyCommand);
  const [query, setQuery] = useState("");
  const selectedOnly = useNavigationStore((s) => s.diseaseSelectedOnly);
  const setSelectedOnly = useNavigationStore((s) => s.setDiseaseSelectedOnly);

  useEffect(() => {
    if (selected.length > 0) {
      setSelectedOnly(true);
    }
  }, [selected, setSelectedOnly]);

  const matches = searchDiseases(query);
  const related = new Set(
    selected.flatMap((id) => diseasesForStructure(id, model).map((d) => d.id)),
  );
  const shown = selectedOnly ? matches.filter((d) => related.has(d.id)) : matches;

  return (
    <section
      className="h-full overflow-y-auto px-4 py-5 text-slate-200"
      aria-label={fa ? "کتابخانه بیماری‌ها" : "Disease library"}
    >
      {/* Header card with academic provenance */}
      <div className="rounded-2xl border border-teal-400/20 bg-gradient-to-br from-teal-950/80 via-slate-900 to-slate-950 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300">
            <Stethoscope size={18} aria-hidden="true" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-400/30 bg-teal-400/10 px-2 py-0.5 text-[10px] text-teal-200">
            <BookOpen size={11} />
            Robbins & Harrison
          </span>
        </div>
        <p className="mt-2 text-[10px] font-semibold tracking-widest text-teal-300">
          HOOMAAN · {fa ? "اطلس پاتولوژی بالینی" : "CLINICAL PATHOLOGY ATLAS"}
        </p>
        <h2 className="mt-1 text-base font-bold text-white">
          {fa ? "بیماری‌ها و آسیب‌شناسی کالبد" : "Pathology & Clinical Conditions"}
        </h2>
        <p className="mt-1.5 text-xs leading-5 text-slate-300">
          {fa
            ? "پیوند میان ساختارهای کالبدی و بیماری‌های بالینی بر پایه رابینز و هاریسون."
            : "Direct correlation between 3D organs and clinical diseases from Robbins & Harrison."}
        </p>
      </div>

      {/* Search Input */}
      <label className="relative mt-4 block">
        <span className="sr-only">{fa ? "جست‌وجوی بیماری" : "Search diseases"}</span>
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-3 text-slate-400"
          style={fa ? { right: 12 } : { left: 12 }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={fa ? "نام بیماری، علائم یا اندام…" : "Search disease, symptoms, or organ…"}
          className={`w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30 ${
            fa ? "pr-10 pl-3" : "pl-10 pr-3"
          }`}
        />
      </label>

      {/* Filter by selection toggle */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={selectedOnly}
            onChange={(e) => setSelectedOnly(e.target.checked)}
            className="h-4 w-4 rounded accent-teal-400"
          />
          <span className="font-medium">
            {fa ? "فقط بیماری‌های عضو انتخاب‌شده" : "Only linked to current selection"}
          </span>
        </label>
        {selected.length > 0 && (
          <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
            {selected.length} {fa ? "عضو انتخابی" : "selected"}
          </span>
        )}
      </div>

      {/* Results status */}
      <p className="mt-3 text-xs leading-5 text-slate-400" role="status">
        {fa
          ? `${shown.length} بیماری بالینی تدوین‌شده بر پایه مراجع پزشکی ۲۰۲۴-۲۰۲۶`
          : `${shown.length} clinical conditions compiled from medical references`}
      </p>

      {/* Disease Cards */}
      <div className="mt-3 space-y-3">
        {shown.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs leading-6 text-slate-400">
            <AlertCircle size={20} className="mx-auto mb-2 text-amber-400/70" />
            <p>
              {fa
                ? "بیماری مرتبطی برای این عضو یا عبارت جستجو یافت نشد."
                : "No matching conditions found for this selection or query."}
            </p>
            {selectedOnly && (
              <button
                type="button"
                onClick={() => setSelectedOnly(false)}
                className="mt-2 text-teal-400 underline underline-offset-4 hover:text-teal-300"
              >
                {fa ? "مشاهده تمام بیماری‌های اطلس" : "Browse all atlas conditions"}
              </button>
            )}
          </div>
        )}

        {shown.map((d) => {
          const categoryMeta = CATEGORY_STYLES[d.category] || CATEGORY_STYLES.digestive;

          return (
            <article
              key={d.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg transition-all hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${categoryMeta.badgeClass}`}
                >
                  {fa ? categoryMeta.fa : categoryMeta.en}
                </span>
                <span className="text-[10px] text-slate-500">{d.id}</span>
              </div>

              <h3 className="mt-2 text-sm font-bold text-slate-100">
                {fa ? d.name.fa : d.name.en}
              </h3>
              <p className="text-xs italic text-slate-400" dir="ltr">
                {fa ? d.name.en : d.name.fa}
              </p>

              <p className="mt-3 text-xs leading-6 text-slate-300">
                {fa ? d.summary.fa : d.summary.en}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-300/90">
                <strong className="text-slate-200">
                  {fa ? "پیامد فیزیوپاتولوژیک: " : "Pathophysiology: "}
                </strong>
                {fa ? d.effect.fa : d.effect.en}
              </p>

              {d.clinicalSigns && (
                <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-200/90">
                  <strong>{fa ? "تظاهرات بالینی: " : "Clinical signs: "}</strong>
                  {fa ? d.clinicalSigns.fa : d.clinicalSigns.en}
                </div>
              )}

              {/* Mapped anatomical sites & 3D focus triggers */}
              <div className="mt-3.5 space-y-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {fa ? "ساختارهای درگیر در مدل سه‌بعدی:" : "Affected 3D Structures:"}
                </span>

                {d.sites.map((site) => {
                  const ids = site[model]?.filter((id) => organs[id]) ?? [];
                  const isMapped = ids.length > 0;

                  return (
                    <div
                      key={site.en}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/80 px-2.5 py-1.5"
                    >
                      <span className="flex items-center gap-1.5 text-xs text-slate-200">
                        <MapPin size={13} className="text-teal-400 shrink-0" aria-hidden="true" />
                        {fa ? site.fa : site.en}
                      </span>
                      {isMapped ? (
                        <button
                          type="button"
                          aria-label={fa ? `نمایش ${site.fa} در مدل` : `Show ${site.en} on model`}
                          onClick={() => {
                            const organ = organs[ids[0]!]!;
                            apply({
                              action: "set_layer_visibility",
                              system: organ.system,
                              visible: true,
                            });
                            apply({
                              action: "focus_organ",
                              organ_id: organ.organ_id,
                            });
                          }}
                          className="rounded-md bg-teal-400/15 px-2.5 py-0.5 text-xs font-semibold text-teal-300 transition hover:bg-teal-400/25 active:scale-95"
                        >
                          {fa ? "نمایش" : "Show"}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          {fa ? "مدل موجود نیست" : "Not mapped"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Source attribution link */}
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                <span className="truncate max-w-[80%]" title={d.source}>
                  {d.source}
                </span>
                <a
                  href={`https://scholar.google.com/scholar?q=${encodeURIComponent(d.name.en)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-teal-400 hover:text-teal-300"
                >
                  {fa ? "مرجع" : "Ref"}
                  <ArrowUpRight size={12} aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      <OntologySites query={query} selectedOnly={selectedOnly} fa={fa} />
      {!selectedOnly && <MondoSearch query={query} fa={fa} />}
    </section>
  );
}

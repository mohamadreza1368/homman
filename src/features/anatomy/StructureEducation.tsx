import { useEffect, useState } from "react";
import { loadManifest } from "@/lib/manifest";
import type { AnatomyManifest, GenderModel } from "@/lib/schemas";
import { diseasesForStructure } from "@/features/diseases/catalog";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { anatomyConcepts, conceptForStructure } from "./concepts";

export function StructureEducation() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const model = useSceneStore((s) => s.genderModel);
  const selected = useSceneStore((s) => s.selectedOrganIds);
  const organs = useSceneStore((s) => s.organs);
  const id = selected.at(-1);
  const organ = id ? organs[id] : undefined;
  const concept = id ? conceptForStructure(model, id) : undefined;
  const diseases = id ? diseasesForStructure(id, model) : [];

  return <section aria-label={fa ? "پروندهٔ ساختار" : "Structure profile"} className="rounded-2xl border border-teal-800/60 bg-gradient-to-br from-teal-950/50 to-slate-950 p-4">
    <p className="text-[10px] font-semibold tracking-wide text-teal-300">{fa ? "پروندهٔ آموزشی" : "STRUCTURE PROFILE"}</p>
    {!organ ? <p className="mt-2 text-xs leading-6 text-slate-300">{fa ? "یک ساختار را روی بدن یا از فهرست انتخاب کنید تا اطلاعات آن را ببینید." : "Select a structure on the body or in the list to explore it."}</p> : <>
      <h3 className="mt-2 text-sm font-semibold text-white">{fa && concept ? concept.name.fa : organ.name_en}</h3>
      <p dir="ltr" className="mt-1 text-left text-xs text-slate-400">{organ.name_en} · {organ.ta2_latin}</p>
      <p dir="ltr" className="mt-1 break-all text-left text-[10px] text-slate-400">{`atlas:${model}:${organ.organ_id}`}</p>
      <p className="mt-2 text-xs leading-6 text-slate-300">{concept ? (fa ? concept.description.fa : concept.description.en) : (fa ? "توضیح آموزشی برای این ساختار هنوز ثبت نشده است." : "No educational description has been added for this structure yet.")}</p>
      {concept && <>
        <p className="mt-2 text-[10px] text-slate-400" dir="ltr">{concept.id}</p>
        <p className="mt-1 text-[10px] leading-5 text-amber-200/80">{fa ? "محتوا و معادل‌ها نیازمند بازبینی تخصصی‌اند." : "Content and mappings require specialist review."}</p>
        <a href={concept.source} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-teal-300 underline underline-offset-4">{fa ? "منبع آموزشی" : "Educational source"}</a>
      </>}
      <div className="mt-3 border-t border-slate-700 pt-3"><p className="text-xs font-medium text-slate-200">{fa ? "بیماری‌های مرتبط ثبت‌شده" : "Linked conditions"}</p>
        {diseases.length ? <ul className="mt-1 space-y-1 text-xs text-slate-300">{diseases.map((d) => <li key={d.id}>{fa ? d.name.fa : d.name.en}</li>)}</ul> : <p className="mt-1 text-xs leading-5 text-slate-400">{fa ? "هنوز بیماری‌ای در فهرست دستی برای این ساختار ثبت نشده است." : "No condition in the curated list is linked to this structure yet."}</p>}
      </div>
    </>}
  </section>;
}

export function AnatomyCoverage() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Partial<Record<GenderModel, AnatomyManifest>>>({});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || (models.male && models.female)) return;
    const controller = new AbortController();
    setFailed(false);
    Promise.all([loadManifest("male", controller.signal), loadManifest("female", controller.signal)])
      .then(([male, female]) => setModels({ male, female }))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [open, models]);
  return <details onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
    <summary className="cursor-pointer text-xs font-semibold text-teal-200">{fa ? "پوشش مدل‌های بدن" : "Body model coverage"}</summary>
    {open && <div className="mt-2 text-xs leading-6 text-slate-300">
      {failed && <p role="alert">{fa ? "دریافت اطلاعات مدل ممکن نشد." : "Could not load model information."}</p>}
      {!failed && (!models.male || !models.female) && <p role="status">{fa ? "در حال دریافت اطلاعات…" : "Loading…"}</p>}
      {models.male && models.female && <>
        <p>{fa ? `مدل مرد: ${models.male.organs.length} ساختار ثبت‌شده` : `Male model: ${models.male.organs.length} structures`}</p>
        <p>{fa ? `مدل زن: ${models.female.organs.length} ساختار ثبت‌شده` : `Female model: ${models.female.organs.length} structures`}</p>
        <p className="mt-2 text-slate-400">{fa ? "تعداد قطعه معادل کامل‌بودن آناتومی نیست؛ مدل زن در حال حاضر فقط بخشی از بدن را پوشش می‌دهد." : "Mesh count does not measure anatomical completeness; the female model currently covers only part of the body."}</p>
        <p className="mt-2 text-slate-400">{fa ? "وضعیت تطبیق مفاهیم ثبت‌شده در هومان:" : "Coverage of concepts currently recorded in Homman:"}</p>
        <ul className="mt-2 space-y-1">{anatomyConcepts.map((concept) => <li key={concept.id} className="flex justify-between gap-2"><span>{fa ? concept.name.fa : concept.name.en}</span><span className="text-[10px] text-slate-400">{fa ? `مرد: ${concept.models.male.length ? "دارد" : "ثبت نشده"} · زن: ${concept.models.female.length ? "دارد" : "ثبت نشده"}` : `M: ${concept.models.male.length ? "mapped" : "unmapped"} · F: ${concept.models.female.length ? "mapped" : "unmapped"}`}</span></li>)}</ul>
        <p className="mt-2 text-[10px] text-slate-400">{fa ? "ثبت‌نشده به معنی نبود قطعی ساختار نیست؛ ممکن است مدل بخش‌های جداگانه‌ای داشته باشد که هنوز معادل‌سازی نشده‌اند." : "Unmapped does not mean absent; component meshes may exist without a reviewed mapping."}</p>
      </>}
    </div>}
  </details>;
}

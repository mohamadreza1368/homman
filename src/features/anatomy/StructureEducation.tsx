import { useEffect, useState } from "react";
import { loadManifest } from "@/lib/manifest";
import type { AnatomyManifest, GenderModel } from "@/lib/schemas";
import { diseasesForStructure } from "@/features/diseases/catalog";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { anatomyConcepts, conceptForStructure } from "./concepts";
import { getMuscleProfile } from "./muscleCatalog";
import { getMicroAnatomyProfile } from "./microAnatomyCatalog";
import { buildFhirBodyStructure, resolveOrganOntology } from "./ontologyCatalog";
import { getJointKinematicsProfile, getTissuePhysicsProfile } from "./biomechanicsCatalog";
import { getCranialNerveForOrgan } from "./cranialNervesCatalog";
import { getCoronaryTerritoryForOrgan } from "./coronaryTerritoriesCatalog";
import { getLymphaticDrainageForOrgan } from "./lymphaticDrainageCatalog";
import { getOrthopedicTestForOrgan } from "./orthopedicTestsCatalog";

export function StructureEducation() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const model = useSceneStore((s) => s.genderModel);
  const selected = useSceneStore((s) => s.selectedOrganIds);
  const organs = useSceneStore((s) => s.organs);
  const [fhirCopied, setFhirCopied] = useState(false);
  const id = selected.at(-1);
  const organ = id ? organs[id] : undefined;
  const concept = id ? conceptForStructure(model, id) : undefined;
  const diseases = id ? diseasesForStructure(id, model) : [];
  const muscleProfile = organ ? getMuscleProfile(organ.organ_id) : undefined;
  const microProfile = organ ? getMicroAnatomyProfile(organ.organ_id) : undefined;
  const ontology = organ ? resolveOrganOntology(organ) : undefined;
  const jointProfile = organ ? getJointKinematicsProfile(organ.organ_id) : undefined;
  const tissuePhysics = organ ? getTissuePhysicsProfile(organ.system) : undefined;
  const cranialNerve = organ ? getCranialNerveForOrgan(organ.organ_id) : undefined;
  const coronaryTerritory = organ ? getCoronaryTerritoryForOrgan(organ.organ_id) : undefined;
  const lymphaticPath = organ ? getLymphaticDrainageForOrgan(organ.organ_id) : undefined;
  const orthoTest = organ ? getOrthopedicTestForOrgan(organ.organ_id) : undefined;

  return (
    <section aria-label={fa ? "پروندهٔ ساختار" : "Structure profile"} className="rounded-2xl border border-teal-800/60 bg-gradient-to-br from-teal-950/50 to-slate-950 p-4">
      <p className="text-[10px] font-semibold tracking-wide text-teal-300">{fa ? "پروندهٔ آموزشی" : "STRUCTURE PROFILE"}</p>
      {!organ ? (
        <p className="mt-2 text-xs leading-6 text-slate-300">{fa ? "یک ساختار را روی بدن یا از فهرست انتخاب کنید تا اطلاعات آن را ببینید." : "Select a structure on the body or in the list to explore it."}</p>
      ) : (
        <>
          <h3 className="mt-2 text-sm font-semibold text-white">{fa && concept ? concept.name.fa : (muscleProfile ? (fa ? muscleProfile.nameFa : muscleProfile.nameEn) : organ.name_en)}</h3>
          <p dir="ltr" className="mt-1 text-left text-xs text-slate-400">{organ.name_en} · {organ.ta2_latin}</p>
          <p dir="ltr" className="mt-1 break-all text-left text-[10px] text-slate-400">{`atlas:${model}:${organ.organ_id}`}</p>
          {ontology && (
            <div data-testid="ontology-badges" dir="ltr" className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-mono text-teal-300 border border-teal-700/40">
                {ontology.uberon}
              </span>
              <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-mono text-sky-300 border border-sky-700/40">
                {ontology.fma}
              </span>
              {ontology.snomed && (
                <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-mono text-purple-300 border border-purple-700/40">
                  SCT:{ontology.snomed}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  const payload = JSON.stringify(buildFhirBodyStructure(organ, model), null, 2);
                  navigator.clipboard?.writeText(payload).catch(() => {});
                  setFhirCopied(true);
                  setTimeout(() => setFhirCopied(false), 1800);
                }}
                className="rounded bg-indigo-950/60 px-1.5 py-0.5 text-[9px] font-mono text-indigo-300 border border-indigo-600/40 hover:bg-indigo-900/60"
                title="Copy HL7 FHIR BodyStructure JSON"
              >
                {fhirCopied ? "FHIR ✓" : "FHIR"}
              </button>
            </div>
          )}
          <p className="mt-2 text-xs leading-6 text-slate-300">{concept ? (fa ? concept.description.fa : concept.description.en) : (fa ? "توضیح آموزشی برای این ساختار هنوز ثبت نشده است." : "No educational description has been added for this structure yet.")}</p>
          {concept && (
            <>
              <p className="mt-2 text-[10px] text-slate-400" dir="ltr">{concept.id}</p>
              <p className="mt-1 text-[10px] leading-5 text-amber-200/80">{fa ? "محتوا و معادل‌ها نیازمند بازبینی تخصصی‌اند." : "Content and mappings require specialist review."}</p>
              <a href={concept.source} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-teal-300 underline underline-offset-4">{fa ? "منبع آموزشی" : "Educational source"}</a>
            </>
          )}

          {muscleProfile && (
            <div data-testid="muscle-oiia-card" className="mt-4 rounded-xl border border-amber-600/40 bg-amber-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-amber-700/30 pb-2">
                <span className="text-[11px] font-bold text-amber-300">
                  {fa ? "شناسنامه عملکردی عضله (O / I / I / A)" : "Muscle Functional Profile (O/I/I/A)"}
                </span>
                <div className="flex flex-wrap gap-1">
                  {muscleProfile.spinalRoots.map((root) => (
                    <span
                      key={root}
                      className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-200 border border-amber-500/40"
                      title={fa ? `ریشه نخاعی ${root}` : `Spinal root ${root}`}
                    >
                      {root}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs space-y-2">
                <div>
                  <span className="font-semibold text-amber-200/90">{fa ? "مبدأ (Origin): " : "Origin: "}</span>
                  <span className="text-slate-300">{fa ? muscleProfile.originFa : muscleProfile.originEn}</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-200/90">{fa ? "مَغرس (Insertion): " : "Insertion: "}</span>
                  <span className="text-slate-300">{fa ? muscleProfile.insertionFa : muscleProfile.insertionEn}</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-200/90">{fa ? "عصب‌دهی (Innervation): " : "Innervation: "}</span>
                  <span className="text-slate-300">{fa ? muscleProfile.innervationFa : muscleProfile.innervationEn}</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-200/90">{fa ? "عملکرد حرکتی (Action): " : "Action: "}</span>
                  <span className="text-slate-300">{fa ? muscleProfile.actionFa : muscleProfile.actionEn}</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-200/90">{fa ? "خونرسانی شریانی (Arterial Supply): " : "Arterial Supply: "}</span>
                  <span className="text-slate-300">{fa ? muscleProfile.arterialSupplyFa : muscleProfile.arterialSupplyEn}</span>
                </div>
                <div className="rounded-lg bg-slate-900/70 p-2 border border-slate-700/60 mt-2">
                  <span className="font-semibold text-rose-300">{fa ? "معاینه بالینی و رفلکس (Clinical Test / DTR): " : "Clinical Test / DTR: "}</span>
                  <span className="text-slate-300 leading-5">{fa ? muscleProfile.clinicalTestFa : muscleProfile.clinicalTestEn}</span>
                </div>
              </div>
            </div>
          )}

          {microProfile && (
            <div data-testid="micro-anatomy-card" className="mt-4 rounded-xl border border-cyan-600/40 bg-cyan-950/20 p-3.5 space-y-2.5">
              <div className="border-b border-cyan-700/30 pb-2">
                <span className="text-[11px] font-bold text-cyan-300">
                  {fa ? microProfile.titleFa : microProfile.titleEn}
                </span>
                <p className="text-[10px] text-cyan-200/80 mt-0.5">
                  {fa ? microProfile.unitNameFa : microProfile.unitNameEn}
                </p>
              </div>
              <p className="text-xs leading-5 text-slate-300">
                {fa ? microProfile.summaryFa : microProfile.summaryEn}
              </p>
              <div className="space-y-1.5">
                {microProfile.layers.map((layer, idx) => (
                  <div key={idx} className="rounded-lg bg-slate-900/75 p-2 border border-slate-800 text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: layer.colorHex }}
                      />
                      <span>{fa ? layer.nameFa : layer.nameEn}</span>
                    </div>
                    <p className="mt-1 text-slate-300 leading-4">
                      {fa ? layer.roleFa : layer.roleEn}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(jointProfile || tissuePhysics) && (
            <div data-testid="biomechanics-card" className="mt-4 rounded-xl border border-indigo-600/40 bg-indigo-950/20 p-3.5 space-y-2">
              <div className="border-b border-indigo-700/30 pb-1.5">
                <span className="text-[11px] font-bold text-indigo-300">
                  {fa ? "بیومکانیک، سینماتیک و فیزیک بافت (MuscleMimic)" : "Biomechanics & Tissue Physics (MuscleMimic)"}
                </span>
              </div>
              {jointProfile && (
                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-white">{fa ? jointProfile.nameFa : jointProfile.nameEn}</div>
                  <div dir="ltr" className="text-[10px] font-mono text-indigo-300/90">
                    MyoFullBody: {jointProfile.myoFullBodyId}
                  </div>
                  {jointProfile.axes.map((ax, i) => (
                    <div key={i} className="rounded-lg bg-slate-900/75 p-2 border border-slate-800 text-[11px] space-y-0.5">
                      <div className="flex justify-between font-semibold text-sky-300">
                        <span>{fa ? ax.motionFa : ax.motionEn}</span>
                        <span dir="ltr" className="font-mono text-amber-300">{ax.romDegrees}</span>
                      </div>
                      <div className="text-slate-300">
                        <span className="text-emerald-300">{fa ? "آگونیست: " : "Agonist: "}</span>
                        {fa ? ax.agonistFa : ax.agonistEn}
                      </div>
                      <div className="text-slate-400">
                        <span className="text-rose-300">{fa ? "آنتاگونیست: " : "Antagonist: "}</span>
                        {fa ? ax.antagonistFa : ax.antagonistEn}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const ids = Object.keys(organs).filter((oid) =>
                        jointProfile.relatedMusclePatterns.some((p) => p.test(oid)),
                      );
                      if (ids.length > 0) {
                        useSceneStore.setState({ isolatedOrganIds: ids });
                      }
                    }}
                    className="mt-1 w-full rounded-lg bg-indigo-600/80 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 transition-colors"
                  >
                    {fa ? "ایزوله عضلات آگونیست/آنتاگونیست در سه‌بعدی" : "Isolate Joint Agonists/Antagonists in 3D"}
                  </button>
                </div>
              )}
              {tissuePhysics && (
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-300 pt-1">
                  <div className="rounded bg-slate-900/70 px-2 py-1 border border-slate-800">
                    <span className="text-slate-400">{fa ? "مدول یانگ: " : "Young's: "}</span>
                    <span dir="ltr" className="font-mono text-indigo-200">{tissuePhysics.youngsModulus}</span>
                  </div>
                  <div className="rounded bg-slate-900/70 px-2 py-1 border border-slate-800">
                    <span className="text-slate-400">{fa ? "پواسون / چگالی: " : "Poisson / ρ: "}</span>
                    <span dir="ltr" className="font-mono text-indigo-200">{tissuePhysics.poissonsRatio} · {tissuePhysics.density}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {cranialNerve && (
            <div className="mt-4 rounded-xl border border-purple-600/40 bg-purple-950/20 p-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-purple-300">{fa ? cranialNerve.nameFa : cranialNerve.nameEn}</div>
              <p className="text-slate-300"><strong className="text-amber-300">{fa ? "سوراخ جمجمه: " : "Skull Foramen: "}</strong>{fa ? cranialNerve.skullForamenFa : cranialNerve.skullForamenEn}</p>
              <p className="text-slate-300"><strong className="text-sky-300">{fa ? "معاینه: " : "Exam: "}</strong>{fa ? cranialNerve.bedsideExamFa : cranialNerve.bedsideExamEn}</p>
              <p className="text-rose-200/90">{fa ? cranialNerve.lesionSignFa : cranialNerve.lesionSignEn}</p>
            </div>
          )}

          {coronaryTerritory && (
            <div className="mt-4 rounded-xl border border-rose-600/40 bg-rose-950/20 p-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-rose-300">{fa ? coronaryTerritory.nameFa : coronaryTerritory.nameEn}</div>
              <div dir="ltr" className="flex flex-wrap gap-1">
                {coronaryTerritory.ecgLeads.map((l) => (
                  <span key={l} className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-200 border border-rose-500/40">{l}</span>
                ))}
              </div>
              <p className="text-slate-300">{fa ? coronaryTerritory.myocardialTerritoryFa : coronaryTerritory.myocardialTerritoryEn}</p>
              <p className="text-amber-200/90">{fa ? coronaryTerritory.clinicalPearlFa : coronaryTerritory.clinicalPearlEn}</p>
            </div>
          )}

          {lymphaticPath && (
            <div className="mt-4 rounded-xl border border-emerald-600/40 bg-emerald-950/20 p-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-emerald-300">{fa ? "مسیر تخلیهٔ لنفاوی و گره نگهبان" : "Sentinel Lymphatic Drainage"}</div>
              <p className="text-slate-200">{fa ? lymphaticPath.sentinelNodesFa : lymphaticPath.sentinelNodesEn}</p>
              <p className="text-slate-400">{fa ? lymphaticPath.clinicalPearlFa : lymphaticPath.clinicalPearlEn}</p>
            </div>
          )}

          {orthoTest && (
            <div className="mt-4 rounded-xl border border-indigo-600/40 bg-indigo-950/20 p-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-indigo-300">{fa ? orthoTest.testNameFa : orthoTest.testNameEn}</div>
              <p className="text-slate-300"><strong className="text-amber-300">{fa ? "تکنیک: " : "Technique: "}</strong>{fa ? orthoTest.techniqueFa : orthoTest.techniqueEn}</p>
              <p className="text-emerald-200/90">{fa ? orthoTest.positiveSignFa : orthoTest.positiveSignEn}</p>
            </div>
          )}

          <div className="mt-3 border-t border-slate-700 pt-3">
            <p className="text-xs font-medium text-slate-200">{fa ? "بیماری‌های مرتبط ثبت‌شده" : "Linked conditions"}</p>
            {diseases.length ? (
              <ul className="mt-1 space-y-1 text-xs text-slate-300">
                {diseases.map((d) => (
                  <li key={d.id}>{fa ? d.name.fa : d.name.en}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs leading-5 text-slate-400">{fa ? "هنوز بیماری‌ای در فهرست دستی برای این ساختار ثبت نشده است." : "No condition in the curated list is linked to this structure yet."}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
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
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-teal-200">{fa ? "پوشش مدل‌های بدن" : "Body model coverage"}</summary>
      {open && (
        <div className="mt-2 text-xs leading-6 text-slate-300">
          {failed && <p role="alert">{fa ? "دریافت اطلاعات مدل ممکن نشد." : "Could not load model information."}</p>}
          {!failed && (!models.male || !models.female) && <p role="status">{fa ? "در حال دریافت اطلاعات…" : "Loading…"}</p>}
          {models.male && models.female && (
            <>
              <p>{fa ? `مدل مرد: ${models.male.organs.length} ساختار ثبت‌شده` : `Male model: ${models.male.organs.length} structures`}</p>
              <p>{fa ? `مدل زن: ${models.female.organs.length} ساختار ثبت‌شده` : `Female model: ${models.female.organs.length} structures`}</p>
              <p className="mt-2 text-slate-400">{fa ? "تعداد قطعه معادل کامل‌بودن آناتومی نیست؛ مدل زن در حال حاضر فقط بخشی از بدن را پوشش می‌دهد." : "Mesh count does not measure anatomical completeness; the female model currently covers only part of the body."}</p>
              <p className="mt-2 text-slate-400">{fa ? "وضعیت تطبیق مفاهیم ثبت‌شده در هومان:" : "Coverage of concepts currently recorded in Homman:"}</p>
              <ul className="mt-2 space-y-1">
                {anatomyConcepts.map((concept) => (
                  <li key={concept.id} className="flex justify-between gap-2">
                    <span>{fa ? concept.name.fa : concept.name.en}</span>
                    <span className="text-[10px] text-slate-400">{fa ? `مرد: ${concept.models.male.length ? "دارد" : "ثبت نشده"} · زن: ${concept.models.female.length ? "دارد" : "ثبت نشده"}` : `M: ${concept.models.male.length ? "mapped" : "unmapped"} · F: ${concept.models.female.length ? "mapped" : "unmapped"}`}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-slate-400">{fa ? "ثبت‌نشده به معنی نبود قطعی ساختار نیست؛ ممکن است مدل بخش‌های جداگانه‌ای داشته باشد که هنوز معادل‌سازی نشده‌اند." : "Unmapped does not mean absent; component meshes may exist without a reviewed mapping."}</p>
            </>
          )}
        </div>
      )}
    </details>
  );
}

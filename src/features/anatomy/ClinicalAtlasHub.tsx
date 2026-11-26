import { useState } from "react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import { SurgicalSpacesPanel } from "./SurgicalSpacesPanel";
import { SPINAL_ROOTS_CATALOG } from "./dermatomeMyotomeCatalog";
import { CRANIAL_NERVES_CATALOG } from "./cranialNervesCatalog";
import { CORONARY_TERRITORIES_CATALOG } from "./coronaryTerritoriesCatalog";
import { FASCIAL_COMPARTMENTS_CATALOG } from "./fascialCompartmentsCatalog";
import { LYMPHATIC_DRAINAGE_CATALOG } from "./lymphaticDrainageCatalog";
import { ORTHOPEDIC_TESTS_CATALOG } from "./orthopedicTestsCatalog";

type ClinicalSubTab =
  | "surgical"
  | "dermatomes"
  | "cranial"
  | "coronary"
  | "compartments_lymph"
  | "orthopedics";

export function ClinicalAtlasHub() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const organs = useSceneStore((s) => s.organs);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const clearIsolation = useSceneStore((s) => s.clearIsolation);
  const applyCommand = useSceneStore((s) => s.applyCommand);

  const [tab, setTab] = useState<ClinicalSubTab>("surgical");

  const isolateByPatterns = (patterns: RegExp[]) => {
    const ids = Object.keys(organs).filter((id) => patterns.some((p) => p.test(id)));
    if (ids.length === 0) return;
    const neededSystems = new Set(
      ids.map((id) => organs[id]?.system).filter(Boolean),
    );
    const currentHidden = useSceneStore.getState().hiddenSystems;
    useSceneStore.setState({
      hiddenSystems: currentHidden.filter((s) => !neededSystems.has(s)),
      isolatedOrganIds: ids,
      selectedOrganIds: [ids[0]!],
    });
    applyCommand({ action: "focus_organ", organ_id: ids[0]! });
  };

  const tabs: { id: ClinicalSubTab; labelFa: string; labelEn: string }[] = [
    { id: "surgical", labelFa: "مثلث‌های جراحی", labelEn: "Surgical" },
    { id: "dermatomes", labelFa: "درماتوم/میوتوم", labelEn: "Dermatomes" },
    { id: "cranial", labelFa: "اعصاب مغزی", labelEn: "CN I-XII" },
    { id: "coronary", labelFa: "کرونری و ECG", labelEn: "Coronary" },
    { id: "compartments_lymph", labelFa: "فاشیا و لنف", labelEn: "Fascia/Lymph" },
    { id: "orthopedics", labelFa: "تست ارتوپدی", labelEn: "Orthopedics" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                tab === t.id
                  ? "bg-teal-600 text-white shadow"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {fa ? t.labelFa : t.labelEn}
            </button>
          ))}
        </div>
        {isolatedOrganIds && isolatedOrganIds.length > 0 && (
          <button
            type="button"
            onClick={clearIsolation}
            className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-900/60"
          >
            {fa ? "خروج" : "Reset"}
          </button>
        )}
      </div>

      {tab === "surgical" && <SurgicalSpacesPanel />}

      {tab === "dermatomes" && (
        <div className="space-y-2.5">
          {SPINAL_ROOTS_CATALOG.map((item) => (
            <div key={item.root} className="rounded-xl border border-sky-700/40 bg-slate-950/80 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="rounded bg-sky-600/30 px-2 py-0.5 font-mono font-bold text-sky-300 border border-sky-500/40">
                  {item.root}
                </span>
                <button
                  type="button"
                  onClick={() => isolateByPatterns([...item.musclePatterns, ...item.skinPatterns])}
                  className="rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-500"
                >
                  {fa ? "نمایش در سه‌بعدی" : "Isolate 3D"}
                </button>
              </div>
              <p className="text-slate-200"><strong className="text-sky-300">{fa ? "درماتوم حسی: " : "Dermatome: "}</strong>{fa ? item.sensoryDermatomeFa : item.sensoryDermatomeEn}</p>
              <p className="text-slate-300"><strong className="text-amber-300">{fa ? "میوتوم حرکتی: " : "Myotome: "}</strong>{fa ? item.myotomeActionFa : item.myotomeActionEn}</p>
              <p className="text-slate-300"><strong className="text-emerald-300">{fa ? "رفلکس (DTR): " : "Reflex: "}</strong>{fa ? item.reflexFa : item.reflexEn}</p>
              <p className="text-[11px] text-rose-200/90 bg-rose-950/30 rounded p-1.5 border border-rose-700/30">{fa ? item.clinicalPearlFa : item.clinicalPearlEn}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "cranial" && (
        <div className="space-y-2.5">
          {CRANIAL_NERVES_CATALOG.map((cn) => (
            <div key={cn.id} className="rounded-xl border border-purple-700/40 bg-slate-950/80 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-purple-300">{fa ? cn.nameFa : cn.nameEn}</span>
                <button
                  type="button"
                  onClick={() => isolateByPatterns(cn.organPatterns)}
                  className="shrink-0 rounded-lg bg-purple-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-purple-500"
                >
                  {fa ? "ایزوله ۳D" : "Isolate 3D"}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">{fa ? cn.modalityFa : cn.modalityEn}</p>
              <p className="text-slate-200"><strong className="text-amber-300">{fa ? "سوراخ جمجمه: " : "Foramen: "}</strong>{fa ? cn.skullForamenFa : cn.skullForamenEn}</p>
              <p className="text-slate-300"><strong className="text-sky-300">{fa ? "معاینه بالینی: " : "Exam: "}</strong>{fa ? cn.bedsideExamFa : cn.bedsideExamEn}</p>
              <p className="text-[11px] text-rose-200/90 bg-rose-950/30 rounded p-1.5 border border-rose-700/30">{fa ? cn.lesionSignFa : cn.lesionSignEn}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "coronary" && (
        <div className="space-y-2.5">
          {CORONARY_TERRITORIES_CATALOG.map((cor) => (
            <div key={cor.id} className="rounded-xl border border-rose-700/40 bg-slate-950/80 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-rose-300">{fa ? cor.nameFa : cor.nameEn}</span>
                <button
                  type="button"
                  onClick={() => isolateByPatterns(cor.organPatterns)}
                  className="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-rose-500"
                >
                  {fa ? "ایزوله رگ" : "Isolate 3D"}
                </button>
              </div>
              <div dir="ltr" className="flex flex-wrap gap-1">
                {cor.ecgLeads.map((l) => (
                  <span key={l} className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-200 border border-rose-500/40">
                    {l}
                  </span>
                ))}
              </div>
              <p className="text-slate-200"><strong className="text-amber-300">{fa ? "ناحیه میوکارد: " : "Territory: "}</strong>{fa ? cor.myocardialTerritoryFa : cor.myocardialTerritoryEn}</p>
              <p className="text-slate-300"><strong className="text-sky-300">{fa ? "ریسک هدایتی: " : "Conduction: "}</strong>{fa ? cor.conductionRiskFa : cor.conductionRiskEn}</p>
              <p className="text-[11px] text-amber-200/90 bg-amber-950/30 rounded p-1.5 border border-amber-700/30">{fa ? cor.clinicalPearlFa : cor.clinicalPearlEn}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "compartments_lymph" && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold text-amber-300">{fa ? "کمپارتمان‌های فاشیایی و فاسیوتومی" : "Fascial Compartments"}</h3>
          {FASCIAL_COMPARTMENTS_CATALOG.map((comp) => (
            <div key={comp.id} className="rounded-xl border border-amber-700/40 bg-slate-950/80 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">{fa ? comp.nameFa : comp.nameEn}</span>
                <button
                  type="button"
                  onClick={() => isolateByPatterns(comp.organPatterns)}
                  className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-amber-500"
                >
                  {fa ? "ایزوله ۳D" : "Isolate 3D"}
                </button>
              </div>
              <p className="text-rose-200">{fa ? comp.nerveAtRiskFa : comp.nerveAtRiskEn}</p>
              <p className="text-slate-300">{fa ? comp.fasciotomyPearlFa : comp.fasciotomyPearlEn}</p>
            </div>
          ))}

          <h3 className="pt-2 text-[11px] font-bold text-emerald-300">{fa ? "تخلیه لنفاوی و گره نگهبان (Sentinel Nodes)" : "Lymphatic Sentinel Drainage"}</h3>
          {LYMPHATIC_DRAINAGE_CATALOG.map((ly) => (
            <div key={ly.id} className="rounded-xl border border-emerald-700/40 bg-slate-950/80 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-emerald-300">{fa ? ly.primaryOrganFa : ly.primaryOrganEn}</span>
                <button
                  type="button"
                  onClick={() => isolateByPatterns(ly.organPatterns)}
                  className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500"
                >
                  {fa ? "ایزوله ۳D" : "Isolate 3D"}
                </button>
              </div>
              <p className="text-slate-200">{fa ? ly.sentinelNodesFa : ly.sentinelNodesEn}</p>
              <p className="text-[11px] text-slate-400">{fa ? ly.clinicalPearlFa : ly.clinicalPearlEn}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "orthopedics" && (
        <div className="space-y-2.5">
          {ORTHOPEDIC_TESTS_CATALOG.map((ortho) => (
            <div key={ortho.id} className="rounded-xl border border-indigo-700/40 bg-slate-950/80 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-indigo-300">{fa ? ortho.testNameFa : ortho.testNameEn}</span>
                <button
                  type="button"
                  onClick={() => isolateByPatterns(ortho.organPatterns)}
                  className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-500"
                >
                  {fa ? "ایزوله ۳D" : "Isolate 3D"}
                </button>
              </div>
              <p className="text-slate-200"><strong className="text-sky-300">{fa ? "ساختار هدف: " : "Target: "}</strong>{fa ? ortho.structureTestedFa : ortho.structureTestedEn}</p>
              <p className="text-slate-300"><strong className="text-amber-300">{fa ? "تکنیک معاینه: " : "Technique: "}</strong>{fa ? ortho.techniqueFa : ortho.techniqueEn}</p>
              <p className="text-[11px] text-emerald-200/90 bg-emerald-950/30 rounded p-1.5 border border-emerald-700/30">{fa ? ortho.positiveSignFa : ortho.positiveSignEn}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

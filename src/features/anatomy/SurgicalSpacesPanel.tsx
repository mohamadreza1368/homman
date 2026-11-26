import { useState } from "react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { useSceneStore } from "@/stores/sceneStore";
import {
  SURGICAL_SPACES_CATALOG,
  type SurgicalSpace,
} from "./surgicalSpacesCatalog";

export function SurgicalSpacesPanel() {
  const fa = useInterfaceLanguage((s) => s.language === "fa");
  const isolateSurgicalSpace = useSceneStore((s) => s.isolateSurgicalSpace);
  const clearIsolation = useSceneStore((s) => s.clearIsolation);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);

  const [activeSpaceId, setActiveSpaceId] = useState<string>("calots_triangle");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  const regions: { id: string; labelFa: string; labelEn: string }[] = [
    { id: "all", labelFa: "همه نواحی", labelEn: "All Regions" },
    { id: "neck", labelFa: "گردن", labelEn: "Neck" },
    { id: "abdomen", labelFa: "شکم و کبد", labelEn: "Abdomen" },
    { id: "pelvis_groin", labelFa: "لگن و اینگوینال", labelEn: "Pelvis / Groin" },
    { id: "upper_limb", labelFa: "اندام فوقانی", labelEn: "Upper Limb" },
    { id: "lower_limb", labelFa: "اندام تحتانی", labelEn: "Lower Limb" },
  ];

  const filteredSpaces = SURGICAL_SPACES_CATALOG.filter(
    (space) => selectedRegion === "all" || space.region === selectedRegion
  );

  const activeSpace: SurgicalSpace | undefined =
    SURGICAL_SPACES_CATALOG.find((s) => s.id === activeSpaceId) ?? filteredSpaces[0];

  const handleIsolate = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    isolateSurgicalSpace(spaceId);
  };

  return (
    <section
      aria-label={fa ? "اطلس فضاها و مثلث‌های جراحی" : "Surgical Triangles & Spaces Atlas"}
      className="rounded-2xl border border-emerald-800/60 bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-900 p-4 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-emerald-700/30 pb-3">
        <div>
          <h2 className="text-xs font-bold tracking-wider text-emerald-400">
            {fa ? "اطلس فضاها و مثلث‌های جراحی" : "SURGICAL TRIANGLES & SPACES ATLAS"}
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {fa
              ? "مرجع آناتومی جراحی گری (Gray's Surgical Anatomy) با مرزبندی سه‌بعدی و مانورهای عملیاتی"
              : "Gray's Surgical Anatomy landmarks with 3D spatial isolation & operative pearls"}
          </p>
        </div>
        {isolatedOrganIds && isolatedOrganIds.length > 0 && (
          <button
            type="button"
            onClick={clearIsolation}
            className="rounded-lg bg-rose-950/60 border border-rose-600/50 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/60 transition-colors"
          >
            {fa ? "خروج از ایزولاسیون" : "Exit Isolation"}
          </button>
        )}
      </div>

      {/* Region Filter Buttons */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Region filters">
        {regions.map((reg) => (
          <button
            key={reg.id}
            type="button"
            onClick={() => setSelectedRegion(reg.id)}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${
              selectedRegion === reg.id
                ? "bg-emerald-600 text-white shadow"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-750 hover:text-white"
            }`}
          >
            {fa ? reg.labelFa : reg.labelEn}
          </button>
        ))}
      </div>

      {/* Spaces Pills List */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {filteredSpaces.map((space) => {
          const isActive = space.id === activeSpaceId;
          return (
            <button
              key={space.id}
              type="button"
              onClick={() => handleIsolate(space.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium border transition-all ${
                isActive
                  ? "border-emerald-400 bg-emerald-950/80 text-emerald-200 shadow-md ring-1 ring-emerald-400/50"
                  : "border-slate-700/60 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              {fa ? space.nameFa : space.nameEn}
            </button>
          );
        })}
      </div>

      {/* Active Space Detail Card */}
      {activeSpace && (
        <div className="mt-4 rounded-xl border border-emerald-700/40 bg-slate-950/80 p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                {fa ? activeSpace.nameFa : activeSpace.nameEn}
              </h3>
              <p className="text-[11px] font-mono text-emerald-300/90">
                {fa ? activeSpace.eponymFa : activeSpace.eponymEn}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleIsolate(activeSpace.id)}
              className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors"
            >
              {fa ? "ایزوله در فضای سه‌بعدی" : "Isolate in 3D"}
            </button>
          </div>

          {/* Boundaries */}
          <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800 text-xs space-y-1">
            <span className="font-bold text-emerald-300">
              {fa ? "مرزهای آناتومیک (Boundaries): " : "Anatomical Boundaries: "}
            </span>
            <p className="text-slate-300 leading-5">
              {fa ? activeSpace.boundaries.fa : activeSpace.boundaries.en}
            </p>
          </div>

          {/* Contents */}
          <div className="text-xs space-y-1.5">
            <span className="font-bold text-sky-300">
              {fa ? "محتویات نوروواسکولار و بافتی (Contents):" : "Contents:"}
            </span>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-slate-300">
              {(fa ? activeSpace.contents.fa : activeSpace.contents.en).map((item, idx) => (
                <li
                  key={idx}
                  className="rounded bg-slate-900/60 px-2 py-1 text-[11px] border border-slate-800/60"
                >
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Clinical Significance */}
          <div className="rounded-lg bg-amber-950/25 p-2.5 border border-amber-600/30 text-xs">
            <span className="font-bold text-amber-300">
              {fa ? "اهمیت بالینی و جراحی (Clinical Significance): " : "Clinical Significance: "}
            </span>
            <span className="text-slate-200 leading-5">
              {fa ? activeSpace.clinicalSignificance.fa : activeSpace.clinicalSignificance.en}
            </span>
          </div>

          {/* Surgical Key Point */}
          <div className="rounded-lg bg-rose-950/25 p-2.5 border border-rose-600/30 text-xs">
            <span className="font-bold text-rose-300">
              {fa ? "نکته کلیدی اتاق عمل (Surgical Key Point): " : "Surgical Key Point: "}
            </span>
            <span className="text-slate-200 leading-5">
              {fa ? activeSpace.surgicalKeyPoint.fa : activeSpace.surgicalKeyPoint.en}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

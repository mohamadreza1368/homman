import { useSceneStore } from "@/stores/sceneStore";
import type { GenderModel } from "@/lib/schemas";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * Toggle selector switching between whole-body male atlas and trunk-focused female reference dataset.
 */
export function BodySwitch() {
  const activeGenderModel = useSceneStore((state) => state.genderModel);
  const switchGenderModel = useSceneStore((state) => state.setGenderModel);
  const currentManifest = useSceneStore((state) => state.manifest);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const totalStructuresInManifest = currentManifest?.organs.length ?? 0;

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {isPersian ? "بدن" : "Body"}
      </h2>
      <div
        role="radiogroup"
        aria-label="Anatomical model"
        className="flex gap-1 rounded border border-slate-800 bg-slate-950/60 p-1"
      >
        <ModelVariantOption
          value="male"
          active={activeGenderModel === "male"}
          onPick={switchGenderModel}
          label={isPersian ? "مرد" : "Male"}
          detail={isPersian ? "تمام بدن" : "Whole body"}
        />
        <ModelVariantOption
          value="female"
          active={activeGenderModel === "female"}
          onPick={switchGenderModel}
          label={isPersian ? "زن" : "Female"}
          detail={isPersian ? "فقط تنه" : "Trunk only"}
        />
      </div>

      {activeGenderModel === "female" && isPersian && (
        <div dir="rtl" className="mt-2 text-[10px] leading-relaxed text-slate-400">
          مدل زن از اطلس مرجع NIH است و ستون فقرات، اندام‌های شکمی، لگن و پستان را نشان می‌دهد. جمجمه، قفسهٔ سینه، اندام‌ها و عضلات اسکلتی در دادهٔ منبع موجود نیستند. این مدل متعلق به یک فرد است و نمایندهٔ میانگین بدن نیست: در این نمونه شش مهرهٔ کمری وجود دارد و کلیه‌ها پایین‌تر از موقعیت متعارف T12 تا L3 قرار دارند.
        </div>
      )}

      {activeGenderModel === "female" && !isPersian && (
        <div className="mt-1.5 space-y-1.5 text-[10px] leading-relaxed text-slate-500">
          <p>
            Spine, abdominal organs, pelvis and breast
            {totalStructuresInManifest > 0 ? ` — ${totalStructuresInManifest} structures` : ""}, from the NIH Human Reference
            Atlas. Not a whole female body: no open dataset provides one. For the head,
            thorax or limbs, switch back to the male atlas.
          </p>
          <p>
            There is <strong className="text-slate-400">no skull, ribcage or musculature</strong> here — the source models organs, not a skeleton. What
            is present is complete; what is absent is absent from the data.
          </p>
          <p className="border-t border-slate-800 pt-1.5">
            <strong className="text-slate-400">This is one woman, not the average.</strong>{" "}
            The male atlas draws you the diagram; this one shows you a person, and she
            differs from the textbook in two ways worth knowing before an exam:
          </p>
          <ul className="ml-3 list-disc space-y-1 marker:text-slate-600">
            <li>
              <strong className="text-slate-400">Six lumbar vertebrae</strong>, not
              five — a real variant, in roughly one person in twenty.
            </li>
            <li>
              <strong className="text-slate-400">The kidneys sit low</strong>, spanning
              L1–L5 where the classical description is T12–L3, and the left is 2.7 cm
              longer than the right. Learn <em>T12–L3</em> for the exam.
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}

function ModelVariantOption({
  value,
  active,
  onPick,
  label,
  detail,
}: {
  value: GenderModel;
  active: boolean;
  onPick: (val: GenderModel) => void;
  label: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onPick(value)}
      title={
        active
          ? `Showing the ${label.toLowerCase()} atlas`
          : `Switch to the ${label.toLowerCase()} atlas — this clears the current selection`
      }
      className={`flex flex-1 flex-col items-center rounded px-2 py-1 transition ${
        active
          ? "bg-sky-600/20 text-sky-200 ring-1 ring-inset ring-sky-700/60"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
    >
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[9px] uppercase tracking-wide opacity-70">{detail}</span>
    </button>
  );
}

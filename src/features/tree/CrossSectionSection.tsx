import { memo } from "react";
import { useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { SECTION_PLANES_LIST } from "./treeConstants";

export const CrossSectionSection = memo(function CrossSectionSection() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const activeCrossSection = useSceneStore((state) => state.crossSection);
  const dispatchCommand = useSceneStore((state) => state.applyCommand);

  return (
    <section className="space-y-2 border-t border-slate-800 pt-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {isPersian ? "برش مقطعی" : "Cross-section"}
      </h2>
      <div className="flex gap-1">
        {SECTION_PLANES_LIST.map((plane) => (
          <button
            key={plane}
            type="button"
            onClick={() =>
              dispatchCommand({
                action: "set_cross_section",
                plane,
                position:
                  activeCrossSection?.plane === plane ? activeCrossSection.position : 0,
              })
            }
            className={`flex-1 rounded border px-2 py-1 text-xs capitalize ${
              activeCrossSection?.plane === plane
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-slate-700 text-slate-400"
            }`}
          >
            {isPersian
              ? ({ axial: "افقی", coronal: "تاجی", sagittal: "سهمی" } as const)[plane]
              : plane}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={activeCrossSection?.position ?? 0}
        disabled={!activeCrossSection}
        onChange={(e) =>
          activeCrossSection &&
          dispatchCommand({
            action: "set_cross_section",
            plane: activeCrossSection.plane,
            position: Number(e.target.value),
          })
        }
        className="w-full accent-sky-500 disabled:opacity-30"
      />
    </section>
  );
});

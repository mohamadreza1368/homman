import { memo, useMemo } from "react";
import type { AnatomicalSystem, ManifestOrgan } from "@/lib/schemas";
import { SYSTEM_COLOURS, SYSTEM_LABELS } from "@/features/viewer/palette";
import { useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { PERSIAN_SYSTEM_NAMES } from "./treeConstants";
import { OrganTreeItem } from "./OrganTreeItem";
import { NestedTreeFolder } from "./NestedTreeFolder";
import { buildHierarchyTree } from "./treeHierarchyBuilder";

interface SystemTreeRowProps {
  systemKey: AnatomicalSystem;
  organList: ManifestOrgan[];
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const SystemTreeRow = memo(function SystemTreeRow({
  systemKey,
  organList,
  isOpen,
  onToggleOpen,
}: SystemTreeRowProps) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const hiddenSystems = useSceneStore((state) => state.hiddenSystems);
  const toggleSystemVisibility = useSceneStore((state) => state.toggleSystem);
  const isolateSystemAlone = useSceneStore((state) => state.soloSystem);
  const systemOpacityMap = useSceneStore((state) => state.systemOpacity);
  const stepSystemOpacity = useSceneStore((state) => state.cycleSystemOpacity);
  const applyXrayOnSystem = useSceneStore((state) => state.xraySystem);

  const isHidden = hiddenSystems.includes(systemKey);
  const opacity = systemOpacityMap[systemKey];

  const hierarchy = useMemo(() => buildHierarchyTree(organList), [organList]);

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-200">
        <input
          type="checkbox"
          checked={!isHidden}
          onChange={() => toggleSystemVisibility(systemKey)}
          title={isHidden ? "Load and show this system" : "Hide this system"}
          className="accent-sky-500"
        />
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex flex-1 items-center gap-1.5 text-left hover:text-sky-300"
          aria-expanded={isOpen}
        >
          <span className="w-2 text-[9px] text-slate-500">{isOpen ? "▼" : "▶"}</span>
          <span
            aria-hidden
            title={`${SYSTEM_LABELS[systemKey]} — colour key in viewport`}
            className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/30"
            style={{ backgroundColor: SYSTEM_COLOURS[systemKey] }}
          />
          <span className="capitalize">
            {isPersian ? (PERSIAN_SYSTEM_NAMES[systemKey] ?? systemKey) : systemKey}
          </span>
          <span className="ml-auto text-xs text-slate-500">{organList.length}</span>
        </button>

        <button
          type="button"
          onClick={() => stepSystemOpacity(systemKey)}
          title={
            opacity === undefined
              ? `Make ${systemKey} translucent`
              : `${systemKey} at ${Math.round(opacity * 100)}%`
          }
          className={`shrink-0 rounded border px-1 py-0.5 text-[9px] leading-none ${
            opacity === undefined
              ? "border-slate-700 text-slate-500 hover:border-sky-600 hover:text-sky-300"
              : "border-sky-700/70 bg-sky-600/15 text-sky-300"
          }`}
        >
          ◐
        </button>
        <button
          type="button"
          onClick={() => applyXrayOnSystem(systemKey)}
          title={`Keep ${systemKey} solid and ghost everything else`}
          className="shrink-0 rounded border border-slate-700 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 hover:border-sky-600 hover:text-sky-300"
        >
          {isPersian ? "شفاف‌سازی" : "X-ray"}
        </button>
        <button
          type="button"
          onClick={() => isolateSystemAlone(systemKey)}
          title={`Study ${systemKey} on its own`}
          className="shrink-0 rounded border border-slate-700 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 hover:border-sky-600 hover:text-sky-300"
        >
          {isPersian ? "تکی" : "Solo"}
        </button>
      </div>

      {isOpen && (
        <div className="ml-3 space-y-0.5">
          {hierarchy.subfolders.map((subfolder) => (
            <NestedTreeFolder key={subfolder.key} folder={subfolder} />
          ))}
          {hierarchy.leafOrgans.length > 0 && (
            <ul className="ml-2 space-y-0.5">
              {hierarchy.leafOrgans.map((organItem) => (
                <OrganTreeItem key={organItem.organ_id} organ={organItem} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});

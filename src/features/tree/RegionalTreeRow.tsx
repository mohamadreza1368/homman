import { memo, useMemo, useCallback } from "react";
import type { ManifestOrgan } from "@/lib/schemas";
import { useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import {
  ANATOMICAL_REGIONS,
  type AnatomicalRegionId,
} from "./regionalMapping";
import { NestedTreeFolder } from "./NestedTreeFolder";
import { OrganTreeItem } from "./OrganTreeItem";
import { buildHierarchyTree } from "./treeHierarchyBuilder";

interface RegionalTreeRowProps {
  regionId: AnatomicalRegionId;
  organList: ManifestOrgan[];
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const RegionalTreeRow = memo(function RegionalTreeRow({
  regionId,
  organList,
  isOpen,
  onToggleOpen,
}: RegionalTreeRowProps) {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const hiddenOrganIds = useSceneStore((state) => state.hiddenOrganIds);
  const applyCommand = useSceneStore((state) => state.applyCommand);

  const regionMeta = ANATOMICAL_REGIONS[regionId];
  const allIds = useMemo(() => organList.map((o) => o.organ_id), [organList]);
  const isAllHidden = allIds.length > 0 && allIds.every((id) => hiddenOrganIds.includes(id));

  const hierarchy = useMemo(() => buildHierarchyTree(organList), [organList]);

  const toggleRegionVisibility = useCallback(() => {
    useSceneStore.setState((state) => {
      if (isAllHidden) {
        return {
          hiddenOrganIds: state.hiddenOrganIds.filter((id) => !allIds.includes(id)),
        };
      } else {
        return {
          hiddenOrganIds: Array.from(new Set([...state.hiddenOrganIds, ...allIds])),
        };
      }
    });
  }, [isAllHidden, allIds]);

  const isolateRegion = useCallback(() => {
    useSceneStore.setState({ isolatedOrganIds: allIds });
    if (allIds[0]) {
      applyCommand({ action: "focus_organ", organ_id: allIds[0] });
    }
  }, [allIds, applyCommand]);

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-200">
        <input
          type="checkbox"
          checked={!isAllHidden}
          onChange={toggleRegionVisibility}
          title={isAllHidden ? "نمایش این ناحیه" : "پنهان کردن این ناحیه"}
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
            title={regionMeta.nameEn}
            className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/30"
            style={{ backgroundColor: regionMeta.color }}
          />
          <span className="font-semibold">
            {isPersian ? regionMeta.nameFa : regionMeta.nameEn}
          </span>
          <span className="ml-auto text-xs text-slate-500">{organList.length}</span>
        </button>

        <button
          type="button"
          onClick={isolateRegion}
          title={isPersian ? `مطالعه اختصاصی ناحیه ${regionMeta.nameFa}` : `Solo ${regionMeta.nameEn}`}
          className="shrink-0 rounded border border-slate-700 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 hover:border-sky-600 hover:text-sky-300 transition"
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

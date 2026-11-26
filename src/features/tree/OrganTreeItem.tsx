import { memo } from "react";
import type { ManifestOrgan } from "@/lib/schemas";
import { isOrganVisible, organLabel, organSubtitle, useSceneStore } from "@/stores/sceneStore";

interface OrganTreeItemProps {
  organ: ManifestOrgan;
}

export const OrganTreeItem = memo(function OrganTreeItem({ organ }: OrganTreeItemProps) {
  const hiddenSystems = useSceneStore((state) => state.hiddenSystems);
  const isolatedOrganIds = useSceneStore((state) => state.isolatedOrganIds);
  const selectedOrganIds = useSceneStore((state) => state.selectedOrganIds);
  const hiddenOrganIds = useSceneStore((state) => state.hiddenOrganIds);
  const hideConnective = useSceneStore((state) => state.hideConnective);
  const connectiveIds = useSceneStore((state) => state.connectiveIds);
  const halfDissection = useSceneStore((state) => state.halfDissection);
  const dissectionDepth = useSceneStore((state) => state.dissectionDepth);
  const pathologyOverlays = useSceneStore((state) => state.pathologyOverlays);

  const selectOrgan = useSceneStore((state) => state.selectOrgan);
  const setHoveredOrganId = useSceneStore((state) => state.setHovered);

  const isEntityVisible = isOrganVisible(
    {
      hiddenSystems,
      isolatedOrganIds,
      hiddenOrganIds,
      hideConnective,
      connectiveIds,
      halfDissection,
      dissectionDepth,
    },
    organ,
  );
  const activeOverlay = pathologyOverlays[organ.organ_id];
  const isSelected = selectedOrganIds.includes(organ.organ_id);

  return (
    <li>
      <button
        type="button"
        onMouseEnter={() => setHoveredOrganId(organ.organ_id)}
        onMouseLeave={() => setHoveredOrganId(null)}
        onClick={(event) => selectOrgan(organ.organ_id, event.ctrlKey || event.metaKey)}
        className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition ${
          isSelected ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:bg-slate-800/60"
        } ${isEntityVisible ? "" : "opacity-40"}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate italic">{organLabel(organ)}</span>
          <span className="block truncate text-[10px] text-slate-500">
            {organSubtitle(organ)}
          </span>
        </span>
        {activeOverlay && (
          <span
            className="shrink-0 text-[10px] text-amber-400"
            title={`${activeOverlay.pathology} (${Math.round(activeOverlay.severity * 100)}%)`}
          >
            ●
          </span>
        )}
      </button>
    </li>
  );
});

import { memo, useState, useCallback } from "react";
import { Folder, FolderOpen } from "lucide-react";
import { useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { OrganTreeItem } from "./OrganTreeItem";
import type { TreeFolderNode } from "./treeHierarchyBuilder";

interface NestedTreeFolderProps {
  folder: TreeFolderNode;
  defaultOpen?: boolean;
}

export const NestedTreeFolder = memo(function NestedTreeFolder({
  folder,
  defaultOpen = false,
}: NestedTreeFolderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const hiddenOrganIds = useSceneStore((state) => state.hiddenOrganIds);
  const applyCommand = useSceneStore((state) => state.applyCommand);

  // Recursively collect all organ IDs in this folder
  const getAllChildOrganIds = useCallback((node: TreeFolderNode): string[] => {
    const ids: string[] = node.leafOrgans.map((o) => o.organ_id);
    for (const sub of node.subfolders) {
      ids.push(...getAllChildOrganIds(sub));
    }
    return ids;
  }, []);

  const allOrgans = getAllChildOrganIds(folder);
  const allHidden = allOrgans.length > 0 && allOrgans.every((id) => hiddenOrganIds.includes(id));

  const toggleFolderVisibility = useCallback(() => {
    useSceneStore.setState((state) => {
      if (allHidden) {
        // Unhide all in this folder
        return {
          hiddenOrganIds: state.hiddenOrganIds.filter((id) => !allOrgans.includes(id)),
        };
      } else {
        // Hide all in this folder
        return {
          hiddenOrganIds: Array.from(new Set([...state.hiddenOrganIds, ...allOrgans])),
        };
      }
    });
  }, [allHidden, allOrgans]);

  const isolateFolder = useCallback(() => {
    useSceneStore.setState({ isolatedOrganIds: allOrgans });
    if (allOrgans[0]) {
      applyCommand({ action: "focus_organ", organ_id: allOrgans[0] });
    }
  }, [allOrgans, applyCommand]);

  return (
    <div className="my-0.5">
      <div
        className="group flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-slate-300 hover:bg-slate-800/50 transition-colors"
        style={{ paddingLeft: `${folder.depth * 10 + 6}px` }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
          aria-expanded={isOpen}
        >
          <span className="w-2.5 text-[8px] text-slate-500">{isOpen ? "▼" : "▶"}</span>
          {isOpen ? (
            <FolderOpen className="h-3.5 w-3.5 text-amber-400/80" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-amber-400/60" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="min-w-0 flex-1 truncate text-left font-medium hover:text-sky-300"
        >
          <span>{folder.label}</span>
        </button>

        <span className="text-[10px] text-slate-500 tabular-nums">
          {folder.totalOrganCount}
        </span>

        <button
          type="button"
          onClick={toggleFolderVisibility}
          title={allHidden ? "نمایش این دسته" : "پنهان کردن این دسته"}
          className={`shrink-0 rounded px-1 text-[9px] ${
            allHidden
              ? "text-slate-600 line-through"
              : "text-slate-400 hover:text-sky-300"
          }`}
        >
          {allHidden ? "✕" : "👁"}
        </button>

        <button
          type="button"
          onClick={isolateFolder}
          title={isPersian ? "ایزوله‌سازی این گروه" : "Solo this group"}
          className="opacity-0 group-hover:opacity-100 shrink-0 rounded border border-slate-700 px-1 py-0.2 text-[8px] uppercase text-slate-500 hover:border-sky-600 hover:text-sky-300 transition"
        >
          {isPersian ? "تکی" : "Solo"}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-0.5">
          {folder.subfolders.map((sub) => (
            <NestedTreeFolder key={sub.key} folder={sub} />
          ))}

          {folder.leafOrgans.length > 0 && (
            <ul
              className="space-y-0.5"
              style={{ paddingLeft: `${folder.depth * 10 + 14}px` }}
            >
              {folder.leafOrgans.map((organ) => (
                <OrganTreeItem key={organ.organ_id} organ={organ} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});

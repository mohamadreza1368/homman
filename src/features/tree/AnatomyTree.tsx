import { useMemo, useState } from "react";
import type { AnatomicalSystem, ManifestOrgan } from "@/lib/schemas";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import { StructureSearch } from "./StructureSearch";
import { systemIsOpen } from "./treeConstants";
import { SystemTreeRow } from "./SystemTreeRow";
import { RegionalTreeRow } from "./RegionalTreeRow";
import {
  ORDERED_REGIONS,
  getOrganRegion,
  type AnatomicalRegionId,
} from "./regionalMapping";
import { ViewportPreferencesSection } from "./ViewportPreferencesSection";
import { CrossSectionSection } from "./CrossSectionSection";
import { ExplodedViewSlider } from "./ExplodedViewSlider";

export { systemIsOpen };

/**
 * Hierarchical tree navigator for inspecting, isolating, toggling, and adjusting opacity of organ systems.
 * Supports both Systemic and Regional (Topographic) anatomical hierarchy.
 */
export function AnatomyTree() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const organMap = useSceneStore((state) => state.organs);

  const [treeMode, setTreeMode] = useState<"systemic" | "regional">("systemic");
  const [expandedSystemsMap, setExpandedSystemsMap] = useState<Record<string, boolean>>({});
  const [expandedRegionsMap, setExpandedRegionsMap] = useState<Record<string, boolean>>({});

  const groupedSystems = useMemo(() => {
    const buckets = new Map<AnatomicalSystem, ManifestOrgan[]>();
    for (const organ of Object.values(organMap)) {
      const currentList = buckets.get(organ.system) ?? [];
      currentList.push(organ);
      buckets.set(organ.system, currentList);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => organLabel(a).localeCompare(organLabel(b)));
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [organMap]);

  const groupedRegions = useMemo(() => {
    const buckets = new Map<AnatomicalRegionId, ManifestOrgan[]>();
    for (const reg of ORDERED_REGIONS) {
      buckets.set(reg, []);
    }
    for (const organ of Object.values(organMap)) {
      const regId = getOrganRegion(organ);
      const list = buckets.get(regId);
      if (list) list.push(organ);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => organLabel(a).localeCompare(organLabel(b)));
    }
    return ORDERED_REGIONS.map((reg) => [reg, buckets.get(reg) ?? []] as const);
  }, [organMap]);

  const hasAnyOpenFolder =
    treeMode === "systemic"
      ? groupedSystems.some(([system]) => systemIsOpen(expandedSystemsMap, system))
      : groupedRegions.some(([region]) => systemIsOpen(expandedRegionsMap, region));

  const totalOrgans =
    treeMode === "systemic"
      ? groupedSystems.reduce((acc, [, list]) => acc + list.length, 0)
      : groupedRegions.reduce((acc, [, list]) => acc + list.length, 0);

  const toggleAllFolders = () => {
    if (treeMode === "systemic") {
      setExpandedSystemsMap(
        Object.fromEntries(groupedSystems.map(([sys]) => [sys, !hasAnyOpenFolder])),
      );
    } else {
      setExpandedRegionsMap(
        Object.fromEntries(groupedRegions.map(([reg]) => [reg, !hasAnyOpenFolder])),
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StructureSearch />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section>
          {/* Mode Switcher: Systemic vs Regional */}
          <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-900/90 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setTreeMode("systemic")}
              className={`flex-1 rounded py-1 text-center text-[11px] font-medium transition ${
                treeMode === "systemic"
                  ? "bg-sky-600/30 text-sky-200 border border-sky-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isPersian ? "دستگاهی (سیستمیک)" : "Systemic"}
            </button>
            <button
              type="button"
              onClick={() => setTreeMode("regional")}
              className={`flex-1 rounded py-1 text-center text-[11px] font-medium transition ${
                treeMode === "regional"
                  ? "bg-amber-600/30 text-amber-200 border border-amber-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isPersian ? "منطقه‌ای (توپوگرافیک)" : "Regional"}
            </button>
          </div>

          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {treeMode === "systemic"
                ? isPersian
                  ? "دستگاه‌ها"
                  : "Systems"
                : isPersian
                  ? "نواحی کالبدی"
                  : "Regions"}
            </h2>
            {totalOrgans > 0 && (
              <button
                type="button"
                onClick={toggleAllFolders}
                title={
                  hasAnyOpenFolder
                    ? "Collapse all"
                    : `Expand all — ${totalOrgans} structures`
                }
                className="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 transition hover:border-sky-600 hover:text-sky-300"
              >
                {hasAnyOpenFolder
                  ? isPersian
                    ? "بستن همه"
                    : "Collapse all"
                  : isPersian
                    ? "باز کردن همه"
                    : "Expand all"}
              </button>
            )}
          </div>

          {treeMode === "systemic" &&
            groupedSystems.map(([systemKey, organList]) => (
              <SystemTreeRow
                key={systemKey}
                systemKey={systemKey}
                organList={organList}
                isOpen={systemIsOpen(expandedSystemsMap, systemKey)}
                onToggleOpen={() =>
                  setExpandedSystemsMap((prev) => ({
                    ...prev,
                    [systemKey]: !systemIsOpen(prev, systemKey),
                  }))
                }
              />
            ))}

          {treeMode === "regional" &&
            groupedRegions.map(([regionId, organList]) => (
              <RegionalTreeRow
                key={regionId}
                regionId={regionId}
                organList={organList}
                isOpen={systemIsOpen(expandedRegionsMap, regionId)}
                onToggleOpen={() =>
                  setExpandedRegionsMap((prev) => ({
                    ...prev,
                    [regionId]: !systemIsOpen(prev, regionId),
                  }))
                }
              />
            ))}
        </section>

        <ViewportPreferencesSection />
        <CrossSectionSection />
        <ExplodedViewSlider />
      </div>
    </div>
  );
}

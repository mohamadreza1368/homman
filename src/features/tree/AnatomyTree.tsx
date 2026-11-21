import { useMemo, useState } from "react";
import type { AnatomicalSystem, ManifestOrgan } from "@/lib/schemas";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

import { StructureSearch } from "./StructureSearch";
import { systemIsOpen } from "./treeConstants";
import { SystemTreeRow } from "./SystemTreeRow";
import { ViewportPreferencesSection } from "./ViewportPreferencesSection";
import { CrossSectionSection } from "./CrossSectionSection";
import { ExplodedViewSlider } from "./ExplodedViewSlider";

export { systemIsOpen };

/**
 * Hierarchical tree navigator for inspecting, isolating, toggling, and adjusting opacity of organ systems.
 */
export function AnatomyTree() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const organMap = useSceneStore((state) => state.organs);

  const [expandedSystemsMap, setExpandedSystemsMap] = useState<Record<string, boolean>>({});

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

  const hasAnyOpenFolder = groupedSystems.some(([system]) =>
    systemIsOpen(expandedSystemsMap, system),
  );
  const totalSystemOrgans = groupedSystems.reduce((acc, [, list]) => acc + list.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StructureSearch />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isPersian ? "دستگاه‌ها" : "Systems"}
            </h2>
            {groupedSystems.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setExpandedSystemsMap(
                    Object.fromEntries(groupedSystems.map(([sys]) => [sys, !hasAnyOpenFolder])),
                  )
                }
                title={
                  hasAnyOpenFolder
                    ? "Collapse every system"
                    : `Expand every system — ${totalSystemOrgans} structures`
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

          {groupedSystems.map(([systemKey, organList]) => (
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
        </section>

        <ViewportPreferencesSection />
        <CrossSectionSection />
        <ExplodedViewSlider />
      </div>
    </div>
  );
}

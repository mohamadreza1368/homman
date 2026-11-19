import { useMemo, useState } from "react";

import type { ManifestOrgan } from "@/lib/schemas";
import { organLabel, useSceneStore } from "@/stores/sceneStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

const MAX_DISPLAY_MATCHES = 40;

/**
 * Global search input querying all anatomical entities across loaded and unmounted systems.
 */
export function StructureSearch() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const organInventory = useSceneStore((state) => state.organs);
  const hiddenSystemsList = useSceneStore((state) => state.hiddenSystems);
  const markOrganSelected = useSceneStore((state) => state.selectOrgan);
  const setHoveredOrganId = useSceneStore((state) => state.setHovered);
  const executeSceneCmd = useSceneStore((state) => state.applyCommand);
  const toggleSystemVisibility = useSceneStore((state) => state.toggleSystem);

  const [inputQuery, setInputQuery] = useState("");
  const normalizedQuery = inputQuery.trim().toLowerCase();

  const matchingStructures = useMemo(() => {
    if (normalizedQuery.length < 2) return [];

    const matchedItems: ManifestOrgan[] = [];
    for (const item of Object.values(organInventory)) {
      if (
        item.ta2_latin.toLowerCase().includes(normalizedQuery) ||
        item.name_en.toLowerCase().includes(normalizedQuery)
      ) {
        matchedItems.push(item);
      }
    }

    matchedItems.sort((first, second) => first.ta2_latin.length - second.ta2_latin.length);
    return matchedItems;
  }, [organInventory, normalizedQuery]);

  const visibleMatches = matchingStructures.slice(0, MAX_DISPLAY_MATCHES);

  function handleSelectStructure(organ: ManifestOrgan) {
    if (hiddenSystemsList.includes(organ.system)) {
      toggleSystemVisibility(organ.system);
    }
    markOrganSelected(organ.organ_id);
    executeSceneCmd({ action: "focus_organ", organ_id: organ.organ_id });
  }

  return (
    <section className="border-b border-slate-800 px-3 py-2">
      <div className="relative">
        <input
          type="search"
          value={inputQuery}
          onChange={(event) => setInputQuery(event.target.value)}
          placeholder={isPersian ? "جست‌وجوی ساختار به انگلیسی یا لاتین…" : "Search all structures…"}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 pr-12 text-xs outline-none placeholder:text-slate-600 focus:border-sky-500"
        />
        {normalizedQuery.length >= 2 && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">
            {matchingStructures.length}
          </span>
        )}
      </div>

      {normalizedQuery.length >= 2 && (
        <div className="mt-1 max-h-64 overflow-y-auto rounded border border-slate-800 bg-slate-950/60">
          {visibleMatches.length === 0 && (
            <p className="px-2 py-2 text-[11px] text-slate-600">
              {isPersian ? "ساختاری پیدا نشد." : "No structure matches."}
            </p>
          )}
          {visibleMatches.map((organ) => {
            const isSystemInactive = hiddenSystemsList.includes(organ.system);
            return (
              <button
                key={organ.organ_id}
                type="button"
                onMouseEnter={() => !isSystemInactive && setHoveredOrganId(organ.organ_id)}
                onMouseLeave={() => setHoveredOrganId(null)}
                onClick={() => handleSelectStructure(organ)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-slate-900 px-2 py-1.5 text-left last:border-0 hover:bg-slate-800/60"
              >
                {organ.path.length > 0 && (
                  <span className="w-full truncate text-[9px] text-slate-600">
                    {organ.path.slice(-2).join(" › ")}
                  </span>
                )}
                <span className="w-full truncate text-[11px] italic text-slate-200">
                  {organLabel(organ)}
                </span>
                <span className="flex w-full items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">
                    {organ.name_en}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1 text-[9px] ${
                      isSystemInactive
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isSystemInactive ? `load ${organ.system}` : organ.system}
                  </span>
                </span>
              </button>
            );
          })}
          {matchingStructures.length > visibleMatches.length && (
            <p className="px-2 py-1.5 text-[10px] text-slate-600">
              {matchingStructures.length - visibleMatches.length} more — narrow the search.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

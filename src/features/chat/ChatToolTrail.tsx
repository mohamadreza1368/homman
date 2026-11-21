/**
 * Descriptive labels for automated scene actions displayed in the tool run trace.
 */
export const SCENE_TOOL_DESCRIPTIONS: Record<string, string> = {
  focus_organ: "focused a structure",
  scan_at_structure: "moved the scanner",
  set_heart_rhythm: "set the heart rhythm",
  isolate_structures: "isolated structures",
  isolate_group: "isolated a region",
  show_all_structures: "restored the full view",
  set_layer_visibility: "toggled a system",
  set_layer_opacity: "made a layer see-through",
  xray_system: "faded the other systems back",
  apply_pathology_overlay: "marked a pathology",
  clear_pathology_overlays: "cleared overlays",
  set_cross_section: "cut a section",
  record_case_verdict: "graded the answer",
};

/**
 * Visual badge trail displaying executed scene operations with consecutive count aggregation.
 */
export function ToolTrail({ tools }: { tools: string[] }) {
  if (tools.length === 0) return null;

  const aggregatedToolRuns: { toolName: string; occurrences: number }[] = [];
  for (const toolName of tools) {
    const previousRun = aggregatedToolRuns.at(-1);
    if (previousRun && previousRun.toolName === toolName) {
      previousRun.occurrences += 1;
    } else {
      aggregatedToolRuns.push({ toolName, occurrences: 1 });
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {aggregatedToolRuns.map((record, index) => (
        <span
          key={`${record.toolName}-${index}`}
          className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] text-slate-400"
        >
          {SCENE_TOOL_DESCRIPTIONS[record.toolName] ?? record.toolName}
          {record.occurrences > 1 && ` ×${record.occurrences}`}
        </span>
      ))}
    </div>
  );
}

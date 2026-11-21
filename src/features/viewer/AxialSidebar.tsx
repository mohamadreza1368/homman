import { formatDistance, measureCm } from "./axialSlice";
import type { SectionMeasure } from "./axialSlice";
import { SECTION_STEP_CM } from "./scanBand";
import { SliceTable } from "./SliceTable";
import { WINDOW_PRESET_OPTIONS } from "./axialViewTypes";
import type { WindowPreset } from "./axialViewTypes";

export interface AxialSidebarProps {
  viewTypeName: string;
  currentLevelLabel: string | null;
  isSteppedNavigation: boolean;
  physicalSpanCm: number;
  spatialDomainName: string;
  isCutMode: boolean;
  isFrontalView: boolean;
  isTorchActive: boolean;
  isPersian: boolean;
  windowPreset: WindowPreset;
  onSelectWindowPreset: (preset: WindowPreset) => void;
  onZoom: (factor: number) => void;
  onResetZoom: () => void;
  onClose: () => void;
  isMeasuringMode: boolean;
  onToggleMeasuring: () => void;
  activeDraftMeasure: SectionMeasure | null;
  activeMeasures: SectionMeasure[];
  onClearLevelMeasures: () => void;
  isSavingImage: boolean;
  saveStatusMessage: string | null;
  onClearSaveStatus: () => void;
  onSaveSlice: () => void;
  descriptionSummary: string;
}

export function AxialSidebar({
  viewTypeName,
  currentLevelLabel,
  isSteppedNavigation,
  physicalSpanCm,
  spatialDomainName,
  isCutMode,
  isFrontalView,
  isTorchActive,
  isPersian,
  windowPreset,
  onSelectWindowPreset,
  onZoom,
  onResetZoom,
  onClose,
  isMeasuringMode,
  onToggleMeasuring,
  activeDraftMeasure,
  activeMeasures,
  onClearLevelMeasures,
  isSavingImage,
  saveStatusMessage,
  onClearSaveStatus,
  onSaveSlice,
  descriptionSummary,
}: AxialSidebarProps) {
  return (
    <div className="flex w-72 flex-col gap-3 self-center">
      <p className="text-[10px] uppercase tracking-wider text-cyan-500/70">
        {viewTypeName}
        {currentLevelLabel ? ` · ${currentLevelLabel}` : ""} ·{" "}
        {isSteppedNavigation ? `${SECTION_STEP_CM} cm steps` : "where you let go"}
      </p>

      <div className="flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => onZoom(1 / 1.4)}
          className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
        >
          −
        </button>
        <button
          type="button"
          title="Back to the whole section"
          onClick={onResetZoom}
          className="w-20 rounded border border-slate-700 px-2 py-0.5 tabular-nums text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
        >
          {physicalSpanCm > 0
            ? `${physicalSpanCm.toFixed(physicalSpanCm < 10 ? 1 : 0)} cm`
            : "—"}
        </button>
        <button
          type="button"
          onClick={() => onZoom(1.4)}
          className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
        >
          +
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded border border-slate-700 px-3 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
        >
          Close · Esc
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onToggleMeasuring}
          aria-pressed={isMeasuringMode}
          title="Drag across the section to measure it"
          className={`rounded border px-2 py-0.5 ${
            isMeasuringMode
              ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
              : "border-slate-700 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
          }`}
        >
          Measure
        </button>

        {(isMeasuringMode || activeMeasures.length > 0) && (
          <span className="tabular-nums text-cyan-200">
            {activeDraftMeasure
              ? formatDistance(measureCm(activeDraftMeasure))
              : activeMeasures.length > 0
                ? `${activeMeasures.length} at this ${spatialDomainName}`
                : "drag across it"}
          </span>
        )}

        {activeMeasures.length > 0 && (
          <button
            type="button"
            onClick={onClearLevelMeasures}
            title={`Remove the measurements at this ${spatialDomainName}`}
            className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300"
          >
            Clear
          </button>
        )}

        <button
          type="button"
          disabled={isSavingImage}
          onClick={onSaveSlice}
          title="Save this section as a PNG, with its measurements"
          className="ml-auto rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:border-cyan-700 hover:text-cyan-300 disabled:opacity-40"
        >
          {isSavingImage ? "Saving…" : "Save"}
        </button>
      </div>

      {saveStatusMessage && (
        <button
          type="button"
          onClick={onClearSaveStatus}
          title={saveStatusMessage}
          className="truncate text-left text-[10px] text-slate-500 hover:text-slate-300"
        >
          {saveStatusMessage}
        </button>
      )}

      {isMeasuringMode && (
        <p className="text-[11px] leading-snug text-slate-500">
          Drag again for another; click a number to remove it. Each stays on
          the {spatialDomainName} it was drawn on. Both ends lie in the plane, so this is the
          true distance between those two points —{" "}
          {isCutMode
            ? `but in Cut you are seeing surfaces ${
                isFrontalView ? "behind" : "below"
              } the plane, so the structures under the ends may not be at this ${spatialDomainName}. Slab is the mode to measure a ${spatialDomainName} in.`
            : "and in Slab everything shown is within four millimetres of it."}
        </p>
      )}

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500/80">
          {isPersian ? "پنجرهٔ کنتراست رادیولوژی (Windowing)" : "Radiological Window"}
        </p>
        <div className="flex flex-wrap gap-1">
          {WINDOW_PRESET_OPTIONS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectWindowPreset(preset.id)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                windowPreset === preset.id
                  ? "border border-cyan-400 bg-cyan-950/60 text-cyan-200"
                  : "border border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              {isPersian ? preset.labelFa : preset.labelEn}
            </button>
          ))}
        </div>
      </div>

      <SliceTable compact={false} />

      <p className="text-[11px] leading-snug text-slate-500">
        {descriptionSummary} The wheel steps {SECTION_STEP_CM} cm through the body;
        Ctrl and the wheel, or −/+, magnify. Magnifying re-renders the
        section at the narrower width rather than enlarging what is there,
        so it adds detail instead of pixels. Drag to move; the button gives
        the whole section back.
        {isTorchActive
          ? ` The pointer is the light: the middle is ${
              isFrontalView ? "straight on" : "overhead"
            }, and the edges rake it flat across the section.`
          : ""}
      </p>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { ManifestOrgan } from "@/lib/schemas";
import { activeCase, useCaseStore } from "@/stores/caseStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, regionMembersByNode, useSceneStore } from "@/stores/sceneStore";
import { getPedicleDefinition } from "./pedicleCatalog";

export interface MenuTarget {
  organId: string;
  x: number;
  y: number;
}

interface StructureMenuProps {
  target: MenuTarget | null;
  onClose: () => void;
}

/**
 * Contextual radial/floating menu triggered by right-clicking anatomical geometry in the 3D scene.
 * Exposes hierarchy-aware isolation, selection grouping, camera targeting, and clinical notation.
 */
export function StructureMenu({ target, onClose }: StructureMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRecordingSymptom, setIsRecordingSymptom] = useState(false);

  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const organCatalog = useSceneStore((state) => state.organs);
  const isolateOrgan = useSceneStore((state) => state.studyOrgan);
  const isolatePedicle = useSceneStore((state) => state.isolatePedicle);
  const activeSelection = useSceneStore((state) => state.selectedOrganIds);
  const isolateCurrentSelection = useSceneStore((state) => state.isolateSelection);
  const hideCurrentSelection = useSceneStore((state) => state.hideSelection);
  const isolateParentGroup = useSceneStore((state) => state.studyGroup);
  const executeCommand = useSceneStore((state) => state.applyCommand);
  const isDepthProbeActive = useSceneStore((state) => state.depthProbeVisible);
  const setDepthProbeActive = useSceneStore((state) => state.setDepthProbeVisible);
  const restoreAllSystems = useSceneStore((state) => state.showAllSystems);
  const setHoveredOrgan = useSceneStore((state) => state.setHovered);

  const currentCase = useCaseStore(activeCase);
  const clinicalSymptoms = useCaseStore((state) => state.symptoms);
  const removeSymptom = useCaseStore((state) => state.unmark);

  const targetedOrgan = target ? organCatalog[target.organId] : undefined;
  const existingSymptoms = clinicalSymptoms.filter((s) => s.organ_id === target?.organId);

  // Traverse ancestor branches from innermost to outermost group
  const ancestorHierarchies = useMemo(() => {
    if (!targetedOrgan) return [];
    return [...targetedOrgan.path]
      .reverse()
      .map((ancestorName) => ({
        node: ancestorName,
        count: regionMembersByNode(organCatalog, ancestorName).length,
      }))
      .filter((branch) => branch.count > 1);
  }, [targetedOrgan, organCatalog]);

  // Handle outside click / pointer down and Escape key dismissals
  useEffect(() => {
    if (!target) return;

    const handlePointerDown = (evt: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(evt.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [target, onClose]);

  if (!target || !targetedOrgan) return null;

  const triggerAction = (callback: () => void) => () => {
    callback();
    setHoveredOrgan(null);
    onClose();
  };

  return (
    <div
      ref={containerRef}
      style={{ left: target.x + 2, top: target.y + 2 }}
      role="menu"
      dir={isPersian ? "rtl" : "ltr"}
      className="absolute z-50 w-64 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/98 py-1 text-xs shadow-2xl backdrop-blur"
    >
      <header className="border-b border-slate-800 px-3 py-1.5">
        <p className="truncate italic text-slate-200">{organLabel(targetedOrgan)}</p>
        <p className="truncate text-[10px] text-slate-500">{targetedOrgan.name_en}</p>
      </header>

      <ContextMenuItem onClick={triggerAction(() => isolateOrgan(targetedOrgan.organ_id))}>
        {isPersian ? "جداسازی این ساختار" : "Isolate this structure"}
      </ContextMenuItem>

      {getPedicleDefinition(targetedOrgan.organ_id) && (
        <ContextMenuItem onClick={triggerAction(() => isolatePedicle(targetedOrgan.organ_id))}>
          <span className="text-amber-300 font-medium">
            {isPersian ? "نمایش پدیکل عروقی-عصبی (تغذیه و تخلیه)" : "Show Neurovascular Pedicle"}
          </span>
        </ContextMenuItem>
      )}

      {activeSelection.length > 1 && (
        <>
          <ContextMenuItem onClick={triggerAction(isolateCurrentSelection)}>
            <span>{isPersian ? "جداسازی انتخاب‌شده‌ها" : "Isolate selection"}</span>
            <span className={`${isPersian ? "mr-auto" : "ml-auto"} text-[10px] text-slate-500`}>
              {activeSelection.length}
            </span>
          </ContextMenuItem>
          <ContextMenuItem onClick={triggerAction(hideCurrentSelection)}>
            {isPersian ? "پنهان کردن انتخاب‌شده‌ها" : "Hide selection"}
          </ContextMenuItem>
        </>
      )}

      {ancestorHierarchies.length > 0 && (
        <section aria-label="Groups">
          <p className="px-3 pb-0.5 pt-2 text-[9px] uppercase tracking-wider text-slate-600">
            {isPersian ? "جداسازی گروه مربوطه" : "Isolate the group it belongs to"}
          </p>
          {ancestorHierarchies.map((grp) => (
            <ContextMenuItem key={grp.node} onClick={triggerAction(() => isolateParentGroup(grp.node))}>
              <span className="truncate">{grp.node}</span>
              <span className={`${isPersian ? "mr-auto" : "ml-auto"} shrink-0 text-[10px] text-slate-500`}>
                {grp.count}
              </span>
            </ContextMenuItem>
          ))}
        </section>
      )}

      <hr className="my-1 border-t border-slate-800" />

      <ContextMenuItem
        onClick={triggerAction(() =>
          executeCommand({ action: "focus_organ", organ_id: targetedOrgan.organ_id })
        )}
      >
        {isPersian ? "پرواز به این ساختار" : "Fly to this structure"}
      </ContextMenuItem>

      <ContextMenuItem onClick={triggerAction(restoreAllSystems)}>
        {isPersian ? "نمایش همهٔ ساختارها" : "Show everything"}
      </ContextMenuItem>

      <ContextMenuItem onClick={triggerAction(() => setDepthProbeActive(!isDepthProbeActive))}>
        {isDepthProbeActive
          ? isPersian
            ? "پنهان کردن فهرست مکان‌نما"
            : "Hide the cursor list"
          : isPersian
            ? "نمایش فهرست مکان‌نما"
            : "Show the cursor list"}
      </ContextMenuItem>

      {currentCase && (
        <section aria-label="Case Clinical Records">
          <hr className="my-1 border-t border-slate-800" />
          {isRecordingSymptom ? (
            <SymptomComposer
              organ={targetedOrgan}
              caseId={currentCase.id}
              onDone={() => {
                setIsRecordingSymptom(false);
                setHoveredOrgan(null);
                onClose();
              }}
              onCancel={() => setIsRecordingSymptom(false)}
            />
          ) : (
            <>
              <p className="px-3 pb-0.5 pt-1 text-[9px] uppercase tracking-wider text-slate-600">
                {currentCase.title}
              </p>
              <ContextMenuItem onClick={() => setIsRecordingSymptom(true)}>
                {isPersian ? "ثبت علامت یا شکایت در اینجا" : "Mark a complaint here"}
              </ContextMenuItem>
              {existingSymptoms.length > 0 && (
                <div className="space-y-0.5 px-3 pb-1.5 pt-0.5">
                  {existingSymptoms.map((symptomItem) => (
                    <div key={symptomItem.id} className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-[10px] text-amber-300/90">
                        {symptomItem.symptom}
                        {symptomItem.severity !== null && (
                          <span className="text-slate-500"> · {symptomItem.severity}/10</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeSymptom(symptomItem.id)}
                        title={isPersian ? "حذف این شکایت" : "Remove this complaint"}
                        className="shrink-0 text-[10px] text-slate-600 transition hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

interface SymptomComposerProps {
  organ: ManifestOrgan;
  caseId: string;
  onDone: () => void;
  onCancel: () => void;
}

/** Form panel for annotating a clinical symptom or patient complaint to a specific organ geometry. */
function SymptomComposer({ organ, caseId, onDone, onCancel }: SymptomComposerProps) {
  const submitMark = useCaseStore((state) => state.mark);
  const [description, setDescription] = useState("");
  const [severityLevel, setSeverityLevel] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  const handlePersist = async () => {
    const trimmed = description.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    const result = await submitMark({
      case_id: caseId,
      organ_id: organ.organ_id,
      organ_label: organLabel(organ),
      symptom: trimmed,
      severity: severityLevel,
    });
    setIsSubmitting(false);
    if (result) onDone();
  };

  return (
    <div className="space-y-1.5 px-3 py-2">
      <input
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handlePersist();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={isPersian ? "بیمار در این ناحیه چه مشکلی گزارش می‌کند؟" : "What does the patient report here?"}
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] outline-none placeholder:text-slate-600 focus:border-amber-600"
      />
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={10}
          value={severityLevel}
          onChange={(e) => setSeverityLevel(Number(e.target.value))}
          className="h-1 flex-1 accent-amber-500"
        />
        <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-slate-400">
          {severityLevel}/10
        </span>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => void handlePersist()}
          disabled={isSubmitting || description.trim().length === 0}
          className="flex-1 rounded border border-amber-700/60 bg-amber-500/15 px-2 py-1 text-[10px] text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-40"
        >
          {isPersian ? "ثبت علامت" : "Mark it"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-[10px] text-slate-500 transition hover:text-slate-200"
        >
          {isPersian ? "انصراف" : "cancel"}
        </button>
      </div>
    </div>
  );
}

interface ContextMenuItemProps {
  children: ReactNode;
  onClick: () => void;
}

function ContextMenuItem({ children, onClick }: ContextMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-300 transition-colors hover:bg-sky-600/20 hover:text-sky-200"
    >
      {children}
    </button>
  );
}

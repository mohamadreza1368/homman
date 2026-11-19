import { useEffect, useState } from "react";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, organSubtitle, useSceneStore } from "@/stores/sceneStore";
import { SUPPLY_LABEL, type SupplyKind } from "./supply";
import { useDraggablePanel } from "./useDraggablePanel";

const PANEL_DOCK_COORDINATES_KEY = "hoomaan.studyPanel.v1";

export function IsolationBar() {
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");
  const isolatedKeys = useSceneStore((state) => state.isolatedOrganIds);
  const organRegistry = useSceneStore((state) => state.organs);
  const diseaseOverlays = useSceneStore((state) => state.pathologyOverlays);
  const activeSelection = useSceneStore((state) => state.selectedOrganIds);
  const closeIsolationMode = useSceneStore((state) => state.clearIsolation);
  const removeOrganItem = useSceneStore((state) => state.dropFromIsolation);
  const dispatchCommand = useSceneStore((state) => state.applyCommand);
  const updateHoveredTarget = useSceneStore((state) => state.setHovered);

  const [collapsed, setCollapsed] = useState(false);
  const { ref, position, moved, reset, handleProps } = useDraggablePanel(PANEL_DOCK_COORDINATES_KEY);

  useEffect(() => {
    if (!isolatedKeys) return;
    const onGlobalKey = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") closeIsolationMode();
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, [isolatedKeys, closeIsolationMode]);

  if (!isolatedKeys || isolatedKeys.length === 0) return null;

  const validItems = isolatedKeys
    .map((k) => organRegistry[k])
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (validItems.length === 0) return null;

  const panelInlineStyle = position
    ? { left: position.x, top: position.y }
    : { left: "50%", top: 36, transform: "translateX(-50%)" };

  return (
    <aside className="pointer-events-none absolute inset-0 overflow-hidden" aria-label="Study Isolation Bar">
      <div
        ref={ref}
        style={panelInlineStyle}
        className="pointer-events-auto absolute w-full max-w-2xl overflow-hidden rounded-2xl border border-teal-500/30 bg-slate-900/90 shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
      >
        <header
          {...handleProps}
          onDoubleClick={reset}
          title="Drag to move · double-click to put it back"
          className="flex cursor-grab items-center gap-2 px-2.5 py-1.5 active:cursor-grabbing"
        >
          <span aria-hidden className="shrink-0 select-none text-[11px] leading-none text-slate-600">
            ⠿
          </span>
          <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            {isPersian
              ? `در حال مطالعه · ${validItems.length}`
              : `Studying · ${validItems.length}`}
          </span>

          {collapsed && (
            <span className="min-w-0 flex-1 truncate text-xs italic text-slate-400">
              {validItems.map(organLabel).join(" · ")}
            </span>
          )}

          {moved && (
            <button
              type="button"
              onClick={reset}
              title="Put the panel back where it started"
              className="ml-auto shrink-0 rounded px-1 text-[10px] text-slate-600 transition hover:text-slate-300"
            >
              recentre
            </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? "Show every part" : "Collapse the list"}
            aria-expanded={!collapsed}
            className={`shrink-0 rounded px-1.5 text-[11px] text-slate-500 transition hover:text-slate-200 ${
              collapsed || moved ? "" : "ml-auto"
            }`}
          >
            {collapsed ? "▾" : "▴"}
          </button>

          <SupplyActionToggle kind="vascular" />
          <SupplyActionToggle kind="neural" />

          <button
            type="button"
            onClick={closeIsolationMode}
            className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200"
          >
            Exit · Esc
          </button>
        </header>

        <SupplyStatusFeedback />

        {!collapsed && (
          <div className="flex max-h-[34vh] flex-wrap content-start gap-1 overflow-y-auto border-t border-slate-800 px-2.5 py-2">
            {validItems.map((structure) => (
              <StructureBadge
                key={structure.organ_id}
                label={organLabel(structure)}
                subtitle={organSubtitle(structure)}
                isSelected={activeSelection.includes(structure.organ_id)}
                pathologyName={diseaseOverlays[structure.organ_id]?.pathology}
                onSelectTarget={() =>
                  dispatchCommand({ action: "focus_organ", organ_id: structure.organ_id })
                }
                onHoverChange={(hovering) =>
                  updateHoveredTarget(hovering ? structure.organ_id : null)
                }
                onDismissTarget={() => removeOrganItem(structure.organ_id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function SupplyActionToggle({ kind }: { kind: SupplyKind }) {
  const triggerSupplySearch = useSceneStore((state) => state.requestSupply);
  const activeTask = useSceneStore((state) => state.supplyRequest);
  const busy = activeTask?.kind === kind;

  const hintLabel =
    kind === "vascular"
      ? "Add the arteries and veins that reach what you are studying"
      : "Add the nerves that reach what you are studying";

  return (
    <button
      type="button"
      onClick={() => triggerSupplySearch(kind)}
      disabled={activeTask !== null}
      title={hintLabel}
      className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200 disabled:opacity-40"
    >
      {busy ? "adding…" : `+ ${SUPPLY_LABEL[kind]}`}
    </button>
  );
}

function SupplyStatusFeedback() {
  const resultOutcome = useSceneStore((state) => state.supplyResult);
  if (!resultOutcome) return null;

  const categoryName = SUPPLY_LABEL[resultOutcome.kind];
  const summaryNotice =
    resultOutcome.added === 0
      ? `No ${categoryName} reach this — nothing was added.`
      : `Added ${resultOutcome.added} ${categoryName}.`;

  return (
    <p className="border-t border-slate-800 px-2.5 py-1 text-[10px] text-slate-500">
      {summaryNotice}
    </p>
  );
}

interface StructureBadgeProps {
  label: string;
  subtitle: string;
  isSelected: boolean;
  pathologyName: string | undefined;
  onSelectTarget: () => void;
  onHoverChange: (isHovered: boolean) => void;
  onDismissTarget: () => void;
}

function StructureBadge({
  label,
  subtitle,
  isSelected,
  pathologyName,
  onSelectTarget,
  onHoverChange,
  onDismissTarget,
}: StructureBadgeProps) {
  const cardStyling = isSelected
    ? "border-sky-600/70 bg-sky-600/15"
    : "border-slate-700/70 bg-slate-800/50 hover:border-slate-600";

  return (
    <span
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={`group flex max-w-full items-center overflow-hidden rounded border transition ${cardStyling}`}
    >
      <button
        type="button"
        onClick={onSelectTarget}
        title={pathologyName ? `${subtitle} — ${pathologyName}` : subtitle}
        className="flex min-w-0 items-center gap-1 py-0.5 pl-1.5 pr-1 text-left"
      >
        {pathologyName && (
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
        )}
        <span
          className={`truncate text-[11px] italic ${
            isSelected ? "text-sky-200" : "text-slate-300"
          }`}
        >
          {label}
        </span>
      </button>
      <button
        type="button"
        onClick={onDismissTarget}
        title={`Remove ${subtitle} from the study set`}
        aria-label={`Remove ${subtitle} from the study set`}
        className="shrink-0 px-1 py-0.5 text-[10px] leading-none text-slate-600 opacity-0 transition hover:text-rose-400 focus:opacity-100 group-hover:opacity-100"
      >
        ✕
      </button>
    </span>
  );
}

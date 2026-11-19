import { useEffect, useState } from "react";

import { useInterfaceLanguage } from "@/stores/interfaceLanguage";
import { organLabel, organSubtitle, useSceneStore } from "@/stores/sceneStore";
import { SUPPLY_LABEL, type SupplyKind } from "./supply";
import { useDraggablePanel } from "./useDraggablePanel";

/**
 * HOOMAAN Isolation & Focused Study Management Toolbar.
 * Displays isolated anatomical sets, providing quick focus, multi-structure removal,
 * neurovascular supply queries, and persistent draggable dock coordinates.
 */

const LOCAL_PANEL_POSITION_KEY = "hoomaan.studyPanel.v1";

export function IsolationBar() {
  const isPersian = useInterfaceLanguage((s) => s.language === "fa");
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const organMap = useSceneStore((s) => s.organs);
  const overlays = useSceneStore((s) => s.pathologyOverlays);
  const selectedOrganIds = useSceneStore((s) => s.selectedOrganIds);
  const clearIsolation = useSceneStore((s) => s.clearIsolation);
  const dropFromIsolation = useSceneStore((s) => s.dropFromIsolation);
  const applyCommand = useSceneStore((s) => s.applyCommand);
  const setHovered = useSceneStore((s) => s.setHovered);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const { ref, position, moved, reset, handleProps } = useDraggablePanel(LOCAL_PANEL_POSITION_KEY);

  useEffect(() => {
    if (isolatedOrganIds === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearIsolation();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isolatedOrganIds, clearIsolation]);

  if (isolatedOrganIds === null || isolatedOrganIds.length === 0) return null;

  const activeOrgans = isolatedOrganIds.map((id) => organMap[id]).filter((o) => !!o);
  if (activeOrgans.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={ref}
        style={
          position
            ? { left: position.x, top: position.y }
            : { left: "50%", top: 36, transform: "translateX(-50%)" }
        }
        className="pointer-events-auto absolute w-full max-w-2xl overflow-hidden rounded-2xl border border-teal-500/30 bg-slate-900/90 shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
      >
        <div
          {...handleProps}
          onDoubleClick={reset}
          title="Drag to move · double-click to put it back"
          className="flex cursor-grab items-center gap-2 px-2.5 py-1.5 active:cursor-grabbing"
        >
          <span
            aria-hidden
            className="shrink-0 select-none text-[11px] leading-none text-slate-600"
          >
            ⠿
          </span>
          <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            {isPersian
              ? `در حال مطالعه · ${activeOrgans.length}`
              : `Studying · ${activeOrgans.length}`}
          </span>

          {isCollapsed && (
            <span className="min-w-0 flex-1 truncate text-xs italic text-slate-400">
              {activeOrgans.map(organLabel).join(" · ")}
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
            onClick={() => setIsCollapsed((open) => !open)}
            title={isCollapsed ? "Show every part" : "Collapse the list"}
            aria-expanded={!isCollapsed}
            className={`shrink-0 rounded px-1.5 text-[11px] text-slate-500 transition hover:text-slate-200 ${
              isCollapsed || moved ? "" : "ml-auto"
            }`}
          >
            {isCollapsed ? "▾" : "▴"}
          </button>

          <SupplyButton kind="vascular" />
          <SupplyButton kind="neural" />

          <button
            type="button"
            onClick={clearIsolation}
            className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200"
          >
            Exit · Esc
          </button>
        </div>

        <SupplyNote />

        {!isCollapsed && (
          <div className="flex max-h-[34vh] flex-wrap content-start gap-1 overflow-y-auto border-t border-slate-800 px-2.5 py-2">
            {activeOrgans.map((organ) => (
              <StudyChip
                key={organ.organ_id}
                label={organLabel(organ)}
                subtitle={organSubtitle(organ)}
                selected={selectedOrganIds.includes(organ.organ_id)}
                pathology={overlays[organ.organ_id]?.pathology}
                onFocus={() =>
                  applyCommand({ action: "focus_organ", organ_id: organ.organ_id })
                }
                onHover={(on) => setHovered(on ? organ.organ_id : null)}
                onDrop={() => dropFromIsolation(organ.organ_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SupplyButton({ kind }: { kind: SupplyKind }) {
  const requestSupply = useSceneStore((s) => s.requestSupply);
  const pending = useSceneStore((s) => s.supplyRequest);
  const isWorking = pending?.kind === kind;

  return (
    <button
      type="button"
      onClick={() => requestSupply(kind)}
      disabled={pending !== null}
      title={
        kind === "vascular"
          ? "Add the arteries and veins that reach what you are studying"
          : "Add the nerves that reach what you are studying"
      }
      className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-sky-600 hover:text-sky-200 disabled:opacity-40"
    >
      {isWorking ? "adding…" : `+ ${SUPPLY_LABEL[kind]}`}
    </button>
  );
}

function SupplyNote() {
  const result = useSceneStore((s) => s.supplyResult);
  if (!result) return null;

  return (
    <p className="border-t border-slate-800 px-2.5 py-1 text-[10px] text-slate-500">
      {result.added === 0
        ? `No ${SUPPLY_LABEL[result.kind]} reach this — nothing was added.`
        : `Added ${result.added} ${SUPPLY_LABEL[result.kind]}.`}
    </p>
  );
}

function StudyChip({
  label,
  subtitle,
  selected,
  pathology,
  onFocus,
  onHover,
  onDrop,
}: {
  label: string;
  subtitle: string;
  selected: boolean;
  pathology: string | undefined;
  onFocus: () => void;
  onHover: (on: boolean) => void;
  onDrop: () => void;
}) {
  return (
    <span
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`group flex max-w-full items-center overflow-hidden rounded border transition ${
        selected
          ? "border-sky-600/70 bg-sky-600/15"
          : "border-slate-700/70 bg-slate-800/50 hover:border-slate-600"
      }`}
    >
      <button
        type="button"
        onClick={onFocus}
        title={pathology ? `${subtitle} — ${pathology}` : subtitle}
        className="flex min-w-0 items-center gap-1 py-0.5 pl-1.5 pr-1 text-left"
      >
        {pathology && (
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
          />
        )}
        <span
          className={`truncate text-[11px] italic ${
            selected ? "text-sky-200" : "text-slate-300"
          }`}
        >
          {label}
        </span>
      </button>
      <button
        type="button"
        onClick={onDrop}
        title={`Remove ${subtitle} from the study set`}
        aria-label={`Remove ${subtitle} from the study set`}
        className="shrink-0 px-1 py-0.5 text-[10px] leading-none text-slate-600 opacity-0 transition hover:text-rose-400 focus:opacity-100 group-hover:opacity-100"
      >
        ✕
      </button>
    </span>
  );
}

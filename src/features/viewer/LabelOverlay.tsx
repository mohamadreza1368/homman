import { useEffect, useMemo, useRef } from "react";

import type { ManifestOrgan } from "@/lib/schemas";
import { organLabel, useSceneStore } from "@/stores/sceneStore";

import { backgroundTheme } from "./background";
import { layoutLabels, type LabelAnchor } from "./labelLayout";
import { getViewerHandle, projectToScreen, structurePosition } from "./viewerBridge";

/**
 * HOOMAAN Anatomical Annotation & Label Leader Lines.
 * Projects 3D anatomical centroids onto 2D viewport coordinates, arranging
 * dual-column margin labels with SVG leader lines in real-time.
 */

const MAX_ANNOTATION_LABELS = 40;

export interface LabelPanel {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const FULL_CANVAS: LabelPanel = { left: 0, top: 0, width: 1, height: 1 };

export function LabelOverlay({ panel = FULL_CANVAS }: { panel?: LabelPanel } = {}) {
  const isLabelsActive = useSceneStore((s) => s.labelsVisible);
  const organMap = useSceneStore((s) => s.organs);
  const selectedIds = useSceneStore((s) => s.selectedOrganIds);
  const isolatedIds = useSceneStore((s) => s.isolatedOrganIds);
  const currentTheme = backgroundTheme(useSceneStore((s) => s.background));
  const activeFocusBadge = useSceneStore((s) => s.focusBadge);

  const matchedBadge =
    activeFocusBadge && selectedIds.length === 1 && selectedIds[0] === activeFocusBadge.organId
      ? activeFocusBadge
      : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const labelDomNodes = useRef(new Map<string, HTMLSpanElement>());
  const svgLineNodes = useRef(new Map<string, SVGLineElement>());

  const targetItems = useMemo(
    () => labelTargets(organMap, selectedIds, isolatedIds, isLabelsActive),
    [organMap, selectedIds, isolatedIds, isLabelsActive],
  );

  useEffect(() => {
    if (targetItems.length === 0) return;
    let animFrame = 0;

    const renderLoop = () => {
      animFrame = requestAnimationFrame(renderLoop);
      const viewer = getViewerHandle();
      const hostElem = containerRef.current;
      if (!viewer || !hostElem) return;

      if (panel.left !== 0 || panel.top !== 0) {
        throw new Error("LabelOverlay expects the driven panel at the top left");
      }

      const viewportW = hostElem.clientWidth * panel.width;
      const viewportH = hostElem.clientHeight * panel.height;

      const screenAnchors: LabelAnchor[] = targetItems.map((item) => {
        const worldPos = structurePosition(viewer, item.id);
        if (!worldPos) return { ...item, x: NaN, y: NaN };
        const coords = projectToScreen(worldPos, viewer.camera, viewportW, viewportH);
        return { ...item, x: coords.x, y: coords.y, behind: coords.behind };
      });

      const positioned = layoutLabels(screenAnchors, {
        width: viewportW,
        height: viewportH,
        measure: (text) => {
          for (const node of labelDomNodes.current.values()) {
            if (node.textContent?.endsWith(text)) return node.offsetWidth;
          }
          return 0;
        },
      });

      const visibleSet = new Set(positioned.map((lbl) => lbl.id));

      for (const entry of positioned) {
        const textElem = labelDomNodes.current.get(entry.id);
        const lineElem = svgLineNodes.current.get(entry.id);

        if (textElem) {
          textElem.style.display = "";
          const translateX =
            entry.side === "left" ? entry.labelX - textElem.offsetWidth : entry.labelX;
          const translateY = entry.labelY - textElem.offsetHeight / 2;
          textElem.style.transform = `translate(${translateX}px, ${translateY}px)`;
        }

        if (lineElem) {
          lineElem.style.display = "";
          lineElem.setAttribute("x1", String(entry.x));
          lineElem.setAttribute("y1", String(entry.y));
          lineElem.setAttribute("x2", String(entry.labelX));
          lineElem.setAttribute("y2", String(entry.labelY));
        }
      }

      for (const [id, node] of labelDomNodes.current) {
        if (!visibleSet.has(id)) node.style.display = "none";
      }
      for (const [id, line] of svgLineNodes.current) {
        if (!visibleSet.has(id)) line.style.display = "none";
      }
    };

    animFrame = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animFrame);
  }, [targetItems, panel.left, panel.top, panel.width, panel.height]);

  if (targetItems.length === 0) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full">
        {targetItems.map((target) => (
          <line
            key={target.id}
            ref={(node) => {
              if (node) svgLineNodes.current.set(target.id, node);
              else svgLineNodes.current.delete(target.id);
            }}
            stroke={currentTheme.leader}
            strokeWidth={1}
            style={{ display: "none" }}
          />
        ))}
      </svg>

      {targetItems.map((target) => (
        <span
          key={target.id}
          ref={(node) => {
            if (node) labelDomNodes.current.set(target.id, node);
            else labelDomNodes.current.delete(target.id);
          }}
          style={{
            display: "none",
            top: 0,
            left: 0,
            backgroundColor: currentTheme.chip,
            color: currentTheme.ink,
          }}
          className="absolute flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] italic leading-tight"
        >
          {matchedBadge?.organId === target.id && (
            <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-500/20 px-0.5 text-[8px] font-semibold not-italic text-sky-300">
              {matchedBadge.index}
            </span>
          )}
          {target.text}
        </span>
      ))}
    </div>
  );
}

export function labelTargets(
  organs: Record<string, { organ_id: string; ta2_latin: string; name_en: string }>,
  selectedOrganIds: string[],
  isolatedOrganIds: string[] | null,
  labelsVisible: boolean,
): { id: string; text: string }[] {
  if (!labelsVisible) {
    return selectedOrganIds.length === 1 ? resolveOrganNames(organs, selectedOrganIds) : [];
  }

  const chosenIds = selectedOrganIds.length > 0 ? selectedOrganIds : (isolatedOrganIds ?? []);
  return resolveOrganNames(organs, chosenIds);
}

function resolveOrganNames(
  organs: Record<string, { organ_id: string; ta2_latin: string; name_en: string }>,
  ids: string[],
): { id: string; text: string }[] {
  return ids
    .slice(0, MAX_ANNOTATION_LABELS)
    .map((id) => organs[id])
    .filter((o) => !!o)
    .map((o) => ({ id: o.organ_id, text: organLabel(o as ManifestOrgan) }));
}

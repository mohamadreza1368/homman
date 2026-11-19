import { useCallback, useEffect, useRef, useState } from "react";

import { isOrganVisible, useSceneStore } from "@/stores/sceneStore";
import {
  collectInPath,
  extendPath,
  isLassoMeaningful,
  suppressNextClick,
  type Point,
} from "./areaSelect";
import { backgroundTheme } from "./background";
import { getViewerHandle, positionLookup } from "./viewerBridge";

/**
 * HOOMAAN Freehand Lasso Selection Component.
 * Intercepts Ctrl/Cmd drag gestures in the capture phase to draw closed 2D selection
 * paths, projecting bounding volumes and batching selected anatomical structure IDs.
 */

export function LassoSelect({
  container,
}: {
  container: React.RefObject<HTMLDivElement | null>;
}) {
  const organMap = useSceneStore((s) => s.organs);
  const hiddenSystems = useSceneStore((s) => s.hiddenSystems);
  const hiddenOrganIds = useSceneStore((s) => s.hiddenOrganIds);
  const hideConnective = useSceneStore((s) => s.hideConnective);
  const connectiveIds = useSceneStore((s) => s.connectiveIds);
  const isolatedOrganIds = useSceneStore((s) => s.isolatedOrganIds);
  const addToSelection = useSceneStore((s) => s.addToSelection);
  const currentTheme = backgroundTheme(useSceneStore((s) => s.background));

  const [activePath, setActivePath] = useState<Point[]>([]);
  const [enclosedCount, setEnclosedCount] = useState(0);
  const isInteracting = useRef(false);
  const internalPath = useRef<Point[]>([]);

  const filterVisibleOrgans = useCallback(
    () =>
      Object.values(organMap).filter((organ) =>
        isOrganVisible(
          { hiddenSystems, isolatedOrganIds, hiddenOrganIds, hideConnective, connectiveIds },
          organ,
        ),
      ),
    [organMap, hiddenSystems, isolatedOrganIds, hiddenOrganIds, hideConnective, connectiveIds],
  );

  const completeSelection = useCallback(
    (commitChanges: boolean) => {
      const recordedPoints = internalPath.current;
      isInteracting.current = false;
      internalPath.current = [];
      setActivePath([]);
      setEnclosedCount(0);

      const viewer = getViewerHandle();
      if (viewer?.controls) viewer.controls.enabled = true;
      if (!commitChanges || !viewer || !isLassoMeaningful(recordedPoints)) return;

      const hostElement = container.current;
      if (!hostElement) return;

      const capturedIds = collectInPath(
        filterVisibleOrgans(),
        positionLookup(viewer),
        viewer.camera,
        hostElement.clientWidth,
        hostElement.clientHeight,
        recordedPoints,
      );

      suppressNextClick();
      if (capturedIds.length > 0) addToSelection(capturedIds);
    },
    [addToSelection, container, filterVisibleOrgans],
  );

  useEffect(() => {
    const hostNode = container.current;
    if (!hostNode) return;

    const computeLocalCoords = (e: PointerEvent): Point => {
      const rect = hostNode.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
      const viewer = getViewerHandle();
      if (viewer?.controls) viewer.controls.enabled = false;

      isInteracting.current = true;
      internalPath.current = [computeLocalCoords(e)];
      setActivePath(internalPath.current);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isInteracting.current) return;
      const updated = extendPath(internalPath.current, computeLocalCoords(e));
      if (updated === internalPath.current) return;

      internalPath.current = updated;
      setActivePath(updated);

      const viewer = getViewerHandle();
      if (viewer && isLassoMeaningful(updated)) {
        const found = collectInPath(
          filterVisibleOrgans(),
          positionLookup(viewer),
          viewer.camera,
          hostNode.clientWidth,
          hostNode.clientHeight,
          updated,
        );
        setEnclosedCount(found.length);
      }
    };

    const handlePointerUp = () => {
      if (isInteracting.current) completeSelection(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isInteracting.current) completeSelection(false);
    };

    hostNode.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      hostNode.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);

      const viewer = getViewerHandle();
      if (viewer?.controls) viewer.controls.enabled = true;
    };
  }, [container, completeSelection, filterVisibleOrgans]);

  if (activePath.length < 2) return null;

  const polygonPoints = activePath.map((pt) => `${pt.x},${pt.y}`).join(" ");
  const tail = activePath[activePath.length - 1]!;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full">
        <polygon
          points={polygonPoints}
          fill={currentTheme.leader}
          fillOpacity={0.12}
          stroke={currentTheme.leader}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      </svg>
      <span
        style={{
          transform: `translate(${tail.x + 12}px, ${tail.y + 12}px)`,
          backgroundColor: currentTheme.chip,
          color: currentTheme.ink,
        }}
        className="absolute left-0 top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] tabular-nums"
      >
        {enclosedCount} structure{enclosedCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

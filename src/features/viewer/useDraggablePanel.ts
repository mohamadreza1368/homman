import { useCallback, useEffect, useRef, useState } from "react";
import { readLocal, removeLocal, writeLocal } from "@/lib/localStore";

export interface Point {
  x: number;
  y: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export function clampToBounds(
  requestedPos: Point,
  panelSize: Size2D,
  containerSize: Size2D
): Point {
  const horizontalLimit = Math.max(0, containerSize.width - panelSize.width);
  const verticalLimit = Math.max(0, containerSize.height - panelSize.height);

  const boundedX = Math.min(horizontalLimit, Math.max(0, requestedPos.x));
  const boundedY = Math.min(verticalLimit, Math.max(0, requestedPos.y));

  return { x: boundedX, y: boundedY };
}

function restoreCoordinates(storageKey: string): Point | null {
  try {
    const rawPayload = readLocal(storageKey);
    if (!rawPayload) return null;
    const parsed = JSON.parse(rawPayload);
    if (
      parsed &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
    return null;
  } catch {
    return null;
  }
}

export function useRememberedFlag(
  storageKey: string,
  defaultValue: boolean
): [boolean, (flagValue: boolean) => void] {
  const [flag, setFlag] = useState<boolean>(() => {
    try {
      const persisted = readLocal(storageKey);
      return persisted === null ? defaultValue : persisted === "true";
    } catch {
      return defaultValue;
    }
  });

  const update = useCallback(
    (nextState: boolean) => {
      setFlag(nextState);
      try {
        writeLocal(storageKey, String(nextState));
      } catch {
        // quota exceeded or disabled
      }
    },
    [storageKey]
  );

  return [flag, update];
}

export function useDraggablePanel(storageKey: string) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<Point | null>(() => restoreCoordinates(storageKey));
  const pointerOffsetRef = useRef<Point | null>(null);

  const getGeometry = useCallback(() => {
    const el = panelRef.current;
    const parentContainer = el?.offsetParent as HTMLElement | null;
    if (!el || !parentContainer) return null;
    return {
      nodeRect: el.getBoundingClientRect(),
      parentRect: parentContainer.getBoundingClientRect(),
    };
  }, []);

  useEffect(() => {
    if (!panelPos) return;

    const onWindowResize = () => {
      const geom = getGeometry();
      if (!geom) return;
      setPanelPos((prev) =>
        prev ? clampToBounds(prev, geom.nodeRect, geom.parentRect) : prev
      );
    };

    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [panelPos, getGeometry]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("button, input, a, select, textarea")) {
        return;
      }
      const geom = getGeometry();
      if (!geom) return;

      pointerOffsetRef.current = {
        x: e.clientX - geom.nodeRect.left,
        y: e.clientY - geom.nodeRect.top,
      };

      const initialCoord: Point = {
        x: geom.nodeRect.left - geom.parentRect.left,
        y: geom.nodeRect.top - geom.parentRect.top,
      };

      setPanelPos(clampToBounds(initialCoord, geom.nodeRect, geom.parentRect));
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [getGeometry]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const offset = pointerOffsetRef.current;
      const geom = getGeometry();
      if (!offset || !geom) return;

      const newPos: Point = {
        x: e.clientX - geom.parentRect.left - offset.x,
        y: e.clientY - geom.parentRect.top - offset.y,
      };

      setPanelPos(clampToBounds(newPos, geom.nodeRect, geom.parentRect));
    },
    [getGeometry]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!pointerOffsetRef.current) return;
      pointerOffsetRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (panelPos) {
        try {
          writeLocal(storageKey, JSON.stringify(panelPos));
        } catch {
          // ignore storage write failure
        }
      }
    },
    [panelPos, storageKey]
  );

  const reset = useCallback(() => {
    pointerOffsetRef.current = null;
    setPanelPos(null);
    try {
      removeLocal(storageKey);
    } catch {
      // ignore storage removal failure
    }
  }, [storageKey]);

  return {
    ref: panelRef,
    position: panelPos,
    moved: panelPos !== null,
    reset,
    handleProps: { onPointerDown, onPointerMove, onPointerUp },
  };
}

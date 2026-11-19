/**
 * Hoomaan 3D Viewer - Draggable Floating Panel Hook
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { readLocal, removeLocal, writeLocal } from "@/lib/localStore";

export interface Point {
  x: number;
  y: number;
}

/** Clamps 2D coordinates ensuring panel remains entirely within container boundary. */
export function clampToBounds(
  point: Point,
  panel: { width: number; height: number },
  container: { width: number; height: number },
): Point {
  const maxX = Math.max(container.width - panel.width, 0);
  const maxY = Math.max(container.height - panel.height, 0);
  return {
    x: Math.min(Math.max(point.x, 0), maxX),
    y: Math.min(Math.max(point.y, 0), maxY),
  };
}

function loadSavedPosition(key: string): Point | null {
  try {
    const raw = readLocal(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Point>;
    const { x, y } = parsed;
    return Number.isFinite(x) && Number.isFinite(y) ? { x: x!, y: y! } : null;
  } catch {
    return null;
  }
}

/** Hook synchronizing boolean toggle state with local storage. */
export function useRememberedFlag(
  storageKey: string,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = readLocal(storageKey);
      return raw === null ? fallback : raw === "true";
    } catch {
      return fallback;
    }
  });

  const remember = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        writeLocal(storageKey, String(next));
      } catch {
        // storage disabled or full
      }
    },
    [storageKey],
  );

  return [value, remember];
}

/** Hook providing drag-and-drop mechanics and persistent positioning for floating panels. */
export function useDraggablePanel(storageKey: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Point | null>(() => loadSavedPosition(storageKey));
  const grab = useRef<Point | null>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    const container = node?.offsetParent as HTMLElement | null;
    if (!node || !container) return null;
    return { node: node.getBoundingClientRect(), container: container.getBoundingClientRect() };
  }, []);

  useEffect(() => {
    if (!position) return;
    const handleResize = () => {
      const rects = measure();
      if (!rects) return;
      setPosition((curr) =>
        curr ? clampToBounds(curr, rects.node, rects.container) : curr,
      );
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position, measure]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("button, input, a")) return;
      const rects = measure();
      if (!rects) return;

      grab.current = {
        x: event.clientX - rects.node.left,
        y: event.clientY - rects.node.top,
      };

      setPosition(
        clampToBounds(
          {
            x: rects.node.left - rects.container.left,
            y: rects.node.top - rects.container.top,
          },
          rects.node,
          rects.container,
        ),
      );
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [measure],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const held = grab.current;
      const rects = measure();
      if (!held || !rects) return;

      setPosition(
        clampToBounds(
          {
            x: event.clientX - rects.container.left - held.x,
            y: event.clientY - rects.container.top - held.y,
          },
          rects.node,
          rects.container,
        ),
      );
    },
    [measure],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!grab.current) return;
      grab.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);

      try {
        if (position) writeLocal(storageKey, JSON.stringify(position));
      } catch {
        // ignore write failure
      }
    },
    [position, storageKey],
  );

  const reset = useCallback(() => {
    grab.current = null;
    setPosition(null);
    try {
      removeLocal(storageKey);
    } catch {
      // ignore remove failure
    }
  }, [storageKey]);

  return {
    ref,
    position,
    moved: position !== null,
    reset,
    handleProps: { onPointerDown, onPointerMove, onPointerUp },
  };
}

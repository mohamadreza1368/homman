import { useEffect, type RefObject } from "react";
import { calloutPlacement } from "./layout";
import type { MemoryScene } from "./scene/memorySceneTypes";

interface UseMemoryCalloutOptions {
  calloutTagRef: RefObject<HTMLDivElement | null>;
  containerRootRef: RefObject<HTMLDivElement | null>;
  avatarContainerRef: RefObject<HTMLDivElement | null>;
  leftPanelRef: RefObject<HTMLElement | null>;
  rightPanelRef: RefObject<HTMLElement | null>;
  sceneInstanceRef: RefObject<MemoryScene | null>;
  activeFocusKey: string | null;
}

export function useMemoryCallout({
  calloutTagRef,
  containerRootRef,
  avatarContainerRef,
  leftPanelRef,
  rightPanelRef,
  sceneInstanceRef,
  activeFocusKey,
}: UseMemoryCalloutOptions) {
  useEffect(() => {
    let animId = 0;
    const alignCallout = () => {
      animId = requestAnimationFrame(alignCallout);
      const calloutEl = calloutTagRef.current;
      if (!calloutEl) return;

      const screenPos = activeFocusKey
        ? (sceneInstanceRef.current as any)?.screenPosition?.(activeFocusKey)
        : null;
      if (!screenPos) {
        calloutEl.style.opacity = "0";
        return;
      }

      calloutEl.style.opacity = "1";
      calloutEl.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px)`;

      const tagContainer = calloutEl.querySelector<HTMLElement>(".ml-tag");
      const hostFrame = containerRootRef.current?.getBoundingClientRect();
      if (!tagContainer || !hostFrame) return;

      const getLateralPanelBounds = (panel: HTMLElement | null): DOMRect | null => {
        if (!panel || panel.offsetParent === null) return null;
        if (panel.classList.contains("ml-hidden") || panel.classList.contains("ml-wide")) return null;
        const rect = panel.getBoundingClientRect();
        return rect.width < hostFrame.width * 0.55 ? rect : null;
      };

      let minLeftBound = 0;
      for (const p of [avatarContainerRef.current, leftPanelRef.current]) {
        const bounds = getLateralPanelBounds(p);
        if (bounds) {
          minLeftBound = Math.max(minLeftBound, bounds.right - hostFrame.left);
        }
      }

      const readerBounds = getLateralPanelBounds(rightPanelRef.current);
      const maxRightBound = readerBounds ? readerBounds.left - hostFrame.left : hostFrame.width;
      const naturalTagWidth =
        Math.max(...[...tagContainer.children].map((child) => child.scrollWidth)) + 32;

      const placement = calloutPlacement(screenPos.x, naturalTagWidth, minLeftBound, maxRightBound);
      calloutEl.classList.toggle("ml-flip", placement.side === "left");
      tagContainer.style.maxWidth = `${placement.maxWidth}px`;
    };

    animId = requestAnimationFrame(alignCallout);
    return () => cancelAnimationFrame(animId);
  }, [
    activeFocusKey,
    calloutTagRef,
    containerRootRef,
    avatarContainerRef,
    leftPanelRef,
    rightPanelRef,
    sceneInstanceRef,
  ]);
}

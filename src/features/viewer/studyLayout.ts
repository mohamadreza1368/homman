/**
 * Hoomaan 3D Viewer - Multi-Viewport Split Study Layout
 */

import type { AnatomicalView } from "./cameraViews";

export const MAIN = "main" as const;

export type AuxiliaryView = Extract<AnatomicalView, "anterior" | "left" | "superior">;

export type PanelId = typeof MAIN | AuxiliaryView;

export interface PanelRect {
  id: PanelId;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Computes WebGL fractional viewport rectangles for active study view panels. */
export function panelLayout(active: readonly AuxiliaryView[]): PanelRect[] {
  const [first, second, third] = active;

  if (first === undefined) {
    return [{ id: MAIN, x: 0, y: 0, width: 1, height: 1 }];
  }

  if (second === undefined) {
    return [
      { id: MAIN, x: 0, y: 0, width: 0.5, height: 1 },
      { id: first, x: 0.5, y: 0, width: 0.5, height: 1 },
    ];
  }

  if (third === undefined) {
    return [
      { id: MAIN, x: 0, y: 0, width: 0.5, height: 1 },
      { id: first, x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
      { id: second, x: 0.5, y: 0, width: 0.5, height: 0.5 },
    ];
  }

  return [
    { id: MAIN, x: 0, y: 0.5, width: 0.5, height: 0.5 },
    { id: first, x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    { id: second, x: 0.5, y: 0, width: 0.5, height: 0.5 },
    { id: third, x: 0.5, y: 0, width: 0.5, height: 0.5 },
  ];
}

/** Extracts the primary interactive viewport rectangle. */
export function mainRect(active: readonly AuxiliaryView[]): PanelRect {
  const main = panelLayout(active).find((panel) => panel.id === MAIN);
  if (!main) throw new Error("every layout has a main panel");
  return main;
}

/** Converts WebGL bottom-left coordinate panel rect into standard DOM top-left space. */
export function domRect(rect: PanelRect): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: rect.x,
    top: 1 - (rect.y + rect.height),
    width: rect.width,
    height: rect.height,
  };
}

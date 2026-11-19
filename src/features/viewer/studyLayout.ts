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

export function panelLayout(activeViews: readonly AuxiliaryView[]): PanelRect[] {
  const activeCount = activeViews.length;

  switch (activeCount) {
    case 0:
      return [{ id: MAIN, x: 0, y: 0, width: 1, height: 1 }];

    case 1:
      return [
        { id: MAIN, x: 0, y: 0, width: 0.5, height: 1 },
        { id: activeViews[0]!, x: 0.5, y: 0, width: 0.5, height: 1 },
      ];

    case 2:
      return [
        { id: MAIN, x: 0, y: 0, width: 0.5, height: 1 },
        { id: activeViews[0]!, x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
        { id: activeViews[1]!, x: 0.5, y: 0, width: 0.5, height: 0.5 },
      ];

    default:
      return [
        { id: MAIN, x: 0, y: 0.5, width: 0.5, height: 0.5 },
        { id: activeViews[0]!, x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
        { id: activeViews[1]!, x: 0.5, y: 0, width: 0.5, height: 0.5 },
        { id: activeViews[2]!, x: 0, y: 0, width: 0.5, height: 0.5 },
      ];
  }
}

export function mainRect(activeViews: readonly AuxiliaryView[]): PanelRect {
  const primary = panelLayout(activeViews).find((p) => p.id === MAIN);
  if (!primary) {
    throw new Error("every layout has a main panel");
  }
  return primary;
}

export function domRect(glRect: PanelRect): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: glRect.x,
    top: 1.0 - (glRect.y + glRect.height),
    width: glRect.width,
    height: glRect.height,
  };
}

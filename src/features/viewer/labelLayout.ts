/**
 * Hoomaan 3D Viewer - Dual-Column Anatomical Label Layout Engine
 */

export interface LabelAnchor {
  id: string;
  text: string;
  x: number;
  y: number;
  behind?: boolean;
}

export interface PlacedLabel extends LabelAnchor {
  labelX: number;
  labelY: number;
  side: "left" | "right";
}

export interface LabelLayoutOptions {
  width: number;
  height: number;
  lineHeight?: number;
  margin?: number;
  padding?: number;
  gap?: number;
  measure?: (text: string) => number;
}

const DEFAULTS = {
  lineHeight: 20,
  margin: 12,
  padding: 16,
  gap: 64,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(max, min));
}

/** Non-overlapping vertical stacking pass in downward and upward directions. */
function stackColumn(
  labels: PlacedLabel[],
  lineHeight: number,
  top: number,
  bottom: number,
): void {
  labels.sort((a, b) => a.y - b.y);

  let cursor = top;
  for (const label of labels) {
    label.labelY = Math.max(label.y, cursor);
    cursor = label.labelY + lineHeight;
  }

  cursor = bottom;
  for (let i = labels.length - 1; i >= 0; i--) {
    const label = labels[i]!;
    label.labelY = Math.min(label.labelY, cursor);
    cursor = label.labelY - lineHeight;
  }
}

/**
 * Calculates plate margins and aligns labels into left and right columns.
 */
export function layoutLabels(
  anchors: LabelAnchor[],
  options: LabelLayoutOptions,
): PlacedLabel[] {
  const { width, height } = options;
  const lineHeight = options.lineHeight ?? DEFAULTS.lineHeight;
  const margin = options.margin ?? DEFAULTS.margin;
  const padding = options.padding ?? DEFAULTS.padding;
  const gap = options.gap ?? DEFAULTS.gap;

  const top = padding;
  const bottom = Math.max(height - padding, padding);
  const maxCapacity = Math.max(Math.floor((bottom - top) / lineHeight) + 1, 0);

  const visible = anchors.filter((a) => {
    if (a.behind) return false;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return false;
    return a.x >= 0 && a.x <= width && a.y >= 0 && a.y <= height;
  });

  if (visible.length === 0) return [];

  const minX = Math.min(...visible.map((a) => a.x));
  const maxX = Math.max(...visible.map((a) => a.x));
  const centerX = (minX + maxX) / 2;

  const grouped: Record<"left" | "right", LabelAnchor[]> = { left: [], right: [] };
  for (const a of visible) {
    const side = a.x <= centerX ? "left" : "right";
    if (grouped[side].length < maxCapacity) {
      grouped[side].push(a);
    }
  }

  const measureWidth = (items: LabelAnchor[]) =>
    options.measure ? Math.max(0, ...items.map((it) => options.measure!(it.text))) : 0;

  const leftMaxW = measureWidth(grouped.left);
  const rightMaxW = measureWidth(grouped.right);

  const leftBound = Math.min(margin + leftMaxW, width - margin);
  const rightBound = Math.max(width - margin - rightMaxW, margin);

  const leftColumnX = clamp(minX - gap, leftBound, width - margin);
  const rightColumnX = clamp(maxX + gap, margin, rightBound);

  const placed: Record<"left" | "right", PlacedLabel[]> = { left: [], right: [] };
  for (const side of ["left", "right"] as const) {
    for (const a of grouped[side]) {
      placed[side].push({
        ...a,
        side,
        labelX: side === "left" ? leftColumnX : rightColumnX,
        labelY: a.y,
      });
    }
  }

  stackColumn(placed.left, lineHeight, top, bottom);
  stackColumn(placed.right, lineHeight, top, bottom);

  return [...placed.left, ...placed.right];
}

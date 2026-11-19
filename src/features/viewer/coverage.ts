/**
 * Hoomaan 3D Viewer - Study Coverage Heatmap Mapping
 */

import * as THREE from "three";

const UNTOUCHED = new THREE.Color("#3f4a5a");
const VISITED = new THREE.Color("#1e6f8f");
const DWELT = new THREE.Color("#5eead4");

/** Calculates nonlinear square-root intensity depth for anatomical coverage touches. */
export function coverageDepth(touches: number, busiest: number): number {
  if (touches <= 0 || busiest <= 0) return 0;
  return Math.min(Math.sqrt(touches) / Math.sqrt(busiest), 1);
}

/** Computes interpolated heatmap color for an organ given its touch count. */
export function coverageColour(touches: number, busiest: number): THREE.Color {
  const depth = coverageDepth(touches, busiest);
  if (depth <= 0) return UNTOUCHED.clone();
  return VISITED.clone().lerp(DWELT, depth);
}

/** Finds highest touch count recorded in coverage registry. */
export function busiestTouches(coverage: Record<string, number>): number {
  let highest = 0;
  for (const count of Object.values(coverage)) {
    if (count > highest) highest = count;
  }
  return highest;
}

/** Generates swatch metadata for visual coverage legend. */
export function coverageLegend(busiest: number): { label: string; hex: string }[] {
  if (busiest <= 0) return [];
  return [
    { label: "not yet", hex: `#${UNTOUCHED.getHexString()}` },
    { label: "been here", hex: `#${coverageColour(1, busiest).getHexString()}` },
    {
      label: `most (${busiest})`,
      hex: `#${coverageColour(busiest, busiest).getHexString()}`,
    },
  ];
}

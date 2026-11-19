import * as THREE from "three";

const COLOR_UNVISITED = new THREE.Color("#3f4a5a");
const COLOR_VISITED_MIN = new THREE.Color("#1e6f8f");
const COLOR_VISITED_MAX = new THREE.Color("#5eead4");

export function coverageDepth(visitCount: number, maxVisits: number): number {
  if (visitCount <= 0 || maxVisits <= 0) {
    return 0;
  }
  const ratio = Math.sqrt(visitCount) / Math.sqrt(maxVisits);
  return ratio > 1 ? 1 : ratio;
}

export function coverageColour(visitCount: number, maxVisits: number): THREE.Color {
  const intensity = coverageDepth(visitCount, maxVisits);
  if (intensity <= 0) {
    return COLOR_UNVISITED.clone();
  }
  return COLOR_VISITED_MIN.clone().lerp(COLOR_VISITED_MAX, intensity);
}

export function busiestTouches(recordMap: Record<string, number>): number {
  let highestCount = 0;
  for (const key in recordMap) {
    const val = recordMap[key]!;
    if (val > highestCount) {
      highestCount = val;
    }
  }
  return highestCount;
}

export function coverageLegend(peakVisits: number): { label: string; hex: string }[] {
  if (peakVisits <= 0) {
    return [];
  }
  return [
    { label: "not yet", hex: `#${COLOR_UNVISITED.getHexString()}` },
    { label: "been here", hex: `#${coverageColour(1, peakVisits).getHexString()}` },
    {
      label: `most (${peakVisits})`,
      hex: `#${coverageColour(peakVisits, peakVisits).getHexString()}`,
    },
  ];
}

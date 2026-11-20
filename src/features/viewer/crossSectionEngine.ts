/**
 * Cross-Sectional Scanner & Spatial Slicing Engine
 *
 * Implemented strictly from specs/cross-section-scanner.md
 * Independent Clean-Room implementation for plane cutting, vertebral registration,
 * and intersecting anatomical volume extraction.
 */

export type CutOrientation = 'axial' | 'coronal' | 'sagittal';

export interface VertebralMarker {
  readonly code: string;
  readonly nameFa: string;
  readonly nameEn: string;
  readonly coordinateY: number;
}

export interface VolumeBoundingBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface AnatomicalSlicingTarget {
  readonly id: string;
  readonly titleFa: string;
  readonly titleEn: string;
  readonly bounds: VolumeBoundingBox;
}

export interface SlicePlaneConfig {
  readonly orientation: CutOrientation;
  readonly normalVector: readonly [number, number, number];
  readonly coordinateAxis: 'x' | 'y' | 'z';
}

export interface ScannerEngineState {
  readonly isEnabled: boolean;
  readonly orientation: CutOrientation;
  readonly slicePosition: number;
}

/**
 * Returns plane configuration (normal vector and sliced coordinate axis) based on orientation.
 */
export function getOrientationPlaneConfig(orientation: CutOrientation): SlicePlaneConfig {
  switch (orientation) {
    case 'axial':
      return {
        orientation: 'axial',
        normalVector: [0, 1, 0],
        coordinateAxis: 'y',
      };
    case 'coronal':
      return {
        orientation: 'coronal',
        normalVector: [0, 0, 1],
        coordinateAxis: 'z',
      };
    case 'sagittal':
      return {
        orientation: 'sagittal',
        normalVector: [1, 0, 0],
        coordinateAxis: 'x',
      };
  }
}

/**
 * Finds the nearest vertebral landmark given an axial Y coordinate.
 * If distance exceeds maxDistanceThreshold (e.g., above head or below feet), returns null.
 */
export function identifyVertebralLevel(
  currentY: number,
  markers: readonly VertebralMarker[],
  maxDistanceThreshold: number = 0.12
): VertebralMarker | null {
  if (markers.length === 0) return null;

  let closest: VertebralMarker | null = null;
  let minDiff = Infinity;

  for (const marker of markers) {
    const diff = Math.abs(currentY - marker.coordinateY);
    if (diff < minDiff) {
      minDiff = diff;
      closest = marker;
    }
  }

  if (minDiff > maxDistanceThreshold) {
    return null;
  }

  return closest;
}

/**
 * Filters structures that intersect the cutting plane at the given coordinate.
 * Uses closed intervals [min <= pos <= max] to avoid floating-point boundary omissions.
 */
export function extractIntersectingStructures(
  sliceCoordinate: number,
  axis: 'x' | 'y' | 'z',
  candidates: readonly AnatomicalSlicingTarget[]
): readonly AnatomicalSlicingTarget[] {
  return candidates.filter((item) => {
    let lower: number;
    let upper: number;

    switch (axis) {
      case 'x':
        lower = item.bounds.minX;
        upper = item.bounds.maxX;
        break;
      case 'y':
        lower = item.bounds.minY;
        upper = item.bounds.maxY;
        break;
      case 'z':
        lower = item.bounds.minZ;
        upper = item.bounds.maxZ;
        break;
    }

    return sliceCoordinate >= lower && sliceCoordinate <= upper;
  });
}

/**
 * Immutable state transitions for scanner controls.
 */
export function createInitialScannerState(initialY: number = 0): ScannerEngineState {
  return {
    isEnabled: false,
    orientation: 'axial',
    slicePosition: initialY,
  };
}

export function toggleScannerActive(state: ScannerEngineState): ScannerEngineState {
  return {
    ...state,
    isEnabled: !state.isEnabled,
  };
}

export function updateSliceOrientation(
  state: ScannerEngineState,
  newOrientation: CutOrientation
): ScannerEngineState {
  return {
    ...state,
    orientation: newOrientation,
  };
}

export function updateSlicePosition(
  state: ScannerEngineState,
  newPosition: number
): ScannerEngineState {
  return {
    ...state,
    slicePosition: newPosition,
  };
}

export function resetScannerState(defaultPosition: number = 0): ScannerEngineState {
  return createInitialScannerState(defaultPosition);
}

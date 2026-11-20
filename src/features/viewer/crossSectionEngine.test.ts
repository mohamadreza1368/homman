import { describe, it, expect } from 'vitest';
import {
  VertebralMarker,
  AnatomicalSlicingTarget,
  getOrientationPlaneConfig,
  identifyVertebralLevel,
  extractIntersectingStructures,
  createInitialScannerState,
  toggleScannerActive,
  updateSliceOrientation,
  updateSlicePosition,
  resetScannerState,
} from './crossSectionEngine';

describe('CrossSectionEngine (Spec verification from specs/cross-section-scanner.md)', () => {
  const sampleVertebrae: readonly VertebralMarker[] = [
    { code: 'T7', nameFa: 'مهره هفتم سینه‌ای', nameEn: 'Thoracic Vertebra 7', coordinateY: 0.38 },
    { code: 'T8', nameFa: 'مهره هشتم سینه‌ای', nameEn: 'Thoracic Vertebra 8', coordinateY: 0.35 },
    { code: 'T9', nameFa: 'مهره نهم سینه‌ای', nameEn: 'Thoracic Vertebra 9', coordinateY: 0.31 },
  ];

  const sampleOrgans: readonly AnatomicalSlicingTarget[] = [
    {
      id: 'heart',
      titleFa: 'قلب',
      titleEn: 'Heart',
      bounds: { minX: -0.1, maxX: 0.1, minY: 0.25, maxY: 0.45, minZ: -0.1, maxZ: 0.1 },
    },
    {
      id: 'urinary_bladder',
      titleFa: 'مثانه',
      titleEn: 'Urinary Bladder',
      bounds: { minX: -0.08, maxX: 0.08, minY: -0.4, maxY: -0.25, minZ: -0.05, maxZ: 0.05 },
    },
  ];

  it('Scenario 1: identifies nearest vertebra from Y-axis spatial height', () => {
    // Current Y = 0.34
    const matched = identifyVertebralLevel(0.34, sampleVertebrae);
    expect(matched).not.toBeNull();
    expect(matched?.code).toBe('T8');
    expect(matched?.nameFa).toBe('مهره هشتم سینه‌ای');
  });

  it('Scenario 2: filters intersecting organs at slice Y = 0.35', () => {
    const intersecting = extractIntersectingStructures(0.35, 'y', sampleOrgans);
    expect(intersecting.map((o) => o.id)).toEqual(['heart']);
  });

  it('Scenario 3: switches cutting plane orientation from axial to coronal', () => {
    const axialConfig = getOrientationPlaneConfig('axial');
    expect(axialConfig.normalVector).toEqual([0, 1, 0]);
    expect(axialConfig.coordinateAxis).toBe('y');

    const coronalConfig = getOrientationPlaneConfig('coronal');
    expect(coronalConfig.normalVector).toEqual([0, 0, 1]);
    expect(coronalConfig.coordinateAxis).toBe('z');
  });

  it('Edge Case A: coordinate outside spinal range returns null and empty intersection', () => {
    const matched = identifyVertebralLevel(2.5, sampleVertebrae);
    expect(matched).toBeNull();

    const intersecting = extractIntersectingStructures(2.5, 'y', sampleOrgans);
    expect(intersecting).toHaveLength(0);
  });

  it('Edge Case B: exact boundary match evaluates inclusive on interval limits', () => {
    // Y = 0.25 is exact lower bound of heart
    const atLowerBound = extractIntersectingStructures(0.25, 'y', sampleOrgans);
    expect(atLowerBound.map((o) => o.id)).toContain('heart');

    // Y = 0.45 is exact upper bound of heart
    const atUpperBound = extractIntersectingStructures(0.45, 'y', sampleOrgans);
    expect(atUpperBound.map((o) => o.id)).toContain('heart');
  });

  it('State Transitions: toggles active state, updates position, and resets', () => {
    let state = createInitialScannerState(0.0);
    expect(state.isEnabled).toBe(false);
    expect(state.slicePosition).toBe(0.0);

    state = toggleScannerActive(state);
    expect(state.isEnabled).toBe(true);

    state = updateSliceOrientation(state, 'coronal');
    expect(state.orientation).toBe('coronal');

    state = updateSlicePosition(state, 0.35);
    expect(state.slicePosition).toBe(0.35);

    state = resetScannerState();
    expect(state.isEnabled).toBe(false);
    expect(state.orientation).toBe('axial');
    expect(state.slicePosition).toBe(0.0);
  });
});

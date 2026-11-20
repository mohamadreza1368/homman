import { describe, it, expect } from 'vitest';
import {
  registerSpatialSnapshot,
  removeSpatialSnapshot,
  resolveRestorationState,
  SpatialMemorySnapshot,
  NewSnapshotInput,
} from './spatialMemoryEngine';

describe('SpatialMemoryEngine (Spec verification from specs/spatial-memory-pins.md)', () => {
  const initialCamera = {
    eyePosition: [1.2, 0.8, 2.5] as const,
    lookTarget: [0.0, 0.35, 0.0] as const,
  };

  const sampleInput: NewSnapshotInput = {
    titleFa: 'بررسی قوس آئورت',
    camera: initialCamera,
    focusedOrganIds: ['aorta', 'brachiocephalic_artery'],
    isIsolatedView: true,
  };

  it('Scenario 1: registers new snapshot with incremental list size and preserved attributes', () => {
    const list: SpatialMemorySnapshot[] = [];
    const outcome = registerSpatialSnapshot(list, sampleInput, 100, () => 'pin-test-1');

    expect(outcome.isSuccess).toBe(true);
    expect(outcome.snapshots).toHaveLength(1);
    const first = outcome.snapshots[0];
    expect(first).toBeDefined();
    expect(first?.id).toBe('pin-test-1');
    expect(first?.titleFa).toBe('بررسی قوس آئورت');
    expect(first?.camera.eyePosition).toEqual([1.2, 0.8, 2.5]);
    expect(first?.isIsolatedView).toBe(true);
  });

  it('Scenario 2: recalls and restores snapshot coordinates and active organ set', () => {
    const outcome = registerSpatialSnapshot([], sampleInput, 100, () => 'pin-test-1');
    const snapshot = outcome.snapshots[0];
    expect(snapshot).toBeDefined();
    if (!snapshot) throw new Error('Snapshot must exist');

    const available = ['aorta', 'brachiocephalic_artery', 'heart'];
    const restored = resolveRestorationState(snapshot, available);

    expect(restored.camera.eyePosition).toEqual([1.2, 0.8, 2.5]);
    expect(restored.camera.lookTarget).toEqual([0.0, 0.35, 0.0]);
    expect(restored.validOrganIds).toEqual(['aorta', 'brachiocephalic_artery']);
    expect(restored.isIsolatedView).toBe(true);
    expect(restored.missingOrganCount).toBe(0);
  });

  it('Scenario 3: deletes an existing snapshot by ID', () => {
    const item1: SpatialMemorySnapshot = {
      id: 'pin-1',
      titleFa: 'تست ۱',
      timestampMs: 1000,
      camera: initialCamera,
      focusedOrganIds: ['heart'],
      isIsolatedView: false,
    };
    const item2: SpatialMemorySnapshot = {
      id: 'pin-2',
      titleFa: 'تست ۲',
      timestampMs: 2000,
      camera: initialCamera,
      focusedOrganIds: ['aorta'],
      isIsolatedView: false,
    };
    const item3: SpatialMemorySnapshot = {
      id: 'pin-3',
      titleFa: 'تست ۳',
      timestampMs: 3000,
      camera: initialCamera,
      focusedOrganIds: ['liver'],
      isIsolatedView: false,
    };

    const remaining = removeSpatialSnapshot([item1, item2, item3], 'pin-2');
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p) => p.id)).toEqual(['pin-1', 'pin-3']);
  });

  it('Edge Case A: removing non-existent pin ID leaves collection unchanged without error', () => {
    const item1: SpatialMemorySnapshot = {
      id: 'pin-1',
      titleFa: 'تست ۱',
      timestampMs: 1000,
      camera: initialCamera,
      focusedOrganIds: ['heart'],
      isIsolatedView: false,
    };

    const result = removeSpatialSnapshot([item1], 'unknown-pin-id');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('pin-1');
  });

  it('Edge Case B: gracefully ignores vanished organ IDs and reports missing count', () => {
    const snapshot: SpatialMemorySnapshot = {
      id: 'pin-1',
      titleFa: 'تست ۱',
      timestampMs: 1000,
      camera: initialCamera,
      focusedOrganIds: ['heart', 'obsolete_organ_xyz'],
      isIsolatedView: false,
    };

    const available = ['heart', 'lungs'];
    const restored = resolveRestorationState(snapshot, available);

    expect(restored.validOrganIds).toEqual(['heart']);
    expect(restored.missingOrganCount).toBe(1);
  });

  it('Edge Case C: rejects new entries when maximum storage quota is reached', () => {
    const list: SpatialMemorySnapshot[] = [
      {
        id: 'pin-1',
        titleFa: 'تست',
        timestampMs: 1000,
        camera: initialCamera,
        focusedOrganIds: [],
        isIsolatedView: false,
      },
    ];

    const outcome = registerSpatialSnapshot(list, sampleInput, 1);
    expect(outcome.isSuccess).toBe(false);
    expect(outcome.snapshots).toHaveLength(1);
    expect(outcome.rejectionReason).toContain('تکمیل');
  });
});

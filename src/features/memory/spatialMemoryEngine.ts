/**
 * Spatial Memory & Scene Viewpoint Pins Engine
 *
 * Implemented strictly from specs/spatial-memory-pins.md
 * Independent Clean-Room implementation for capturing, indexing,
 * pruning, and restoring 3D anatomical scene states.
 */

export interface CameraPose {
  readonly eyePosition: readonly [number, number, number];
  readonly lookTarget: readonly [number, number, number];
  readonly fieldOfView?: number | undefined;
}

export interface SpatialMemorySnapshot {
  readonly id: string;
  readonly titleFa: string;
  readonly notes?: string | undefined;
  readonly timestampMs: number;
  readonly camera: CameraPose;
  readonly focusedOrganIds: readonly string[];
  readonly isIsolatedView: boolean;
}

export interface NewSnapshotInput {
  readonly titleFa: string;
  readonly notes?: string | undefined;
  readonly camera: CameraPose;
  readonly focusedOrganIds: readonly string[];
  readonly isIsolatedView: boolean;
}

export interface AddSnapshotOutcome {
  readonly isSuccess: boolean;
  readonly snapshots: readonly SpatialMemorySnapshot[];
  readonly rejectionReason?: string;
}

export interface RestoredSceneConfig {
  readonly camera: CameraPose;
  readonly validOrganIds: readonly string[];
  readonly isIsolatedView: boolean;
  readonly missingOrganCount: number;
}

export const MAX_MEMORY_PINS_LIMIT = 100;

/**
 * Adds a new spatial memory snapshot while enforcing collection limits and generating an immutable snapshot.
 */
export function registerSpatialSnapshot(
  existingList: readonly SpatialMemorySnapshot[],
  input: NewSnapshotInput,
  maxAllowed: number = MAX_MEMORY_PINS_LIMIT,
  generateId: () => string = () => `pin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
): AddSnapshotOutcome {
  if (existingList.length >= maxAllowed) {
    return {
      isSuccess: false,
      snapshots: existingList,
      rejectionReason: 'ظرفیت ذخیره نشانک‌های صحنه تکمیل شده است.',
    };
  }

  const newSnapshot: SpatialMemorySnapshot = {
    id: generateId(),
    titleFa: input.titleFa.trim() || 'نشانک بدون عنوان',
    notes: input.notes?.trim(),
    timestampMs: Date.now(),
    camera: {
      eyePosition: [...input.camera.eyePosition],
      lookTarget: [...input.camera.lookTarget],
      fieldOfView: input.camera.fieldOfView,
    },
    focusedOrganIds: [...input.focusedOrganIds],
    isIsolatedView: input.isIsolatedView,
  };

  return {
    isSuccess: true,
    snapshots: [...existingList, newSnapshot],
  };
}

/**
 * Removes a spatial memory snapshot by ID. Returns existing list unmodified if ID not found.
 */
export function removeSpatialSnapshot(
  existingList: readonly SpatialMemorySnapshot[],
  snapshotId: string
): readonly SpatialMemorySnapshot[] {
  return existingList.filter((item) => item.id !== snapshotId);
}

/**
 * Restores camera and organ selection from a snapshot, filtering out any obsolete or unavailable organ IDs.
 */
export function resolveRestorationState(
  snapshot: SpatialMemorySnapshot,
  currentlyAvailableOrganIds: readonly string[]
): RestoredSceneConfig {
  const availableSet = new Set(currentlyAvailableOrganIds);
  const validOrganIds = snapshot.focusedOrganIds.filter((id) => availableSet.has(id));
  const missingOrganCount = snapshot.focusedOrganIds.length - validOrganIds.length;

  return {
    camera: {
      eyePosition: [...snapshot.camera.eyePosition],
      lookTarget: [...snapshot.camera.lookTarget],
      fieldOfView: snapshot.camera.fieldOfView,
    },
    validOrganIds,
    isIsolatedView: snapshot.isIsolatedView,
    missingOrganCount,
  };
}

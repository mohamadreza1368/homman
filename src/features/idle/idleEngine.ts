/**
 * Idle State & Power Conservation Engine
 *
 * Implemented strictly from specs/idle-power-conservation.md
 * Independent Clean-Room implementation for user inactivity tracking,
 * frame-rate throttling, and battery conservation.
 */

export interface IdleEngineConfig {
  readonly idleThresholdMs: number;
  readonly activeFrameRate: number;
  readonly throttledFrameRate: number;
}

export interface IdlePowerState {
  readonly isIdle: boolean;
  readonly lastActiveTimestampMs: number;
  readonly idleThresholdMs: number;
  readonly activeFrameRate: number;
  readonly throttledFrameRate: number;
}

export const DEFAULT_IDLE_THRESHOLD_MS = 60_000;
export const DEFAULT_ACTIVE_FPS = 60;
export const DEFAULT_THROTTLED_FPS = 15;
export const MIN_ALLOWED_THRESHOLD_MS = 10_000;

/**
 * Initializes state with sanitized threshold settings.
 * Threshold <= 0 signifies disabled idle management.
 */
export function createIdlePowerState(
  config?: Partial<IdleEngineConfig>,
  initialTimestampMs: number = Date.now()
): IdlePowerState {
  let threshold = config?.idleThresholdMs ?? DEFAULT_IDLE_THRESHOLD_MS;

  if (threshold < 0) {
    threshold = MIN_ALLOWED_THRESHOLD_MS;
  }

  return {
    isIdle: false,
    lastActiveTimestampMs: initialTimestampMs,
    idleThresholdMs: threshold,
    activeFrameRate: config?.activeFrameRate ?? DEFAULT_ACTIVE_FPS,
    throttledFrameRate: config?.throttledFrameRate ?? DEFAULT_THROTTLED_FPS,
  };
}

/**
 * Invoked on any user input (mouse, touch, key). Wakes system up immediately.
 */
export function recordUserActivity(
  state: IdlePowerState,
  activityTimestampMs: number = Date.now()
): IdlePowerState {
  return {
    ...state,
    isIdle: false,
    lastActiveTimestampMs: activityTimestampMs,
  };
}

/**
 * Evaluates periodic clock tick or visibility change to transition into/out of idle.
 */
export function evaluateIdleTransition(
  state: IdlePowerState,
  currentTimestampMs: number,
  isDocumentHidden: boolean = false
): IdlePowerState {
  // If tab is hidden in background, throttle immediately to save energy
  if (isDocumentHidden) {
    if (!state.isIdle) {
      return { ...state, isIdle: true };
    }
    return state;
  }

  // If idle threshold is 0, idle throttling is disabled by user preference
  if (state.idleThresholdMs === 0) {
    if (state.isIdle) {
      return { ...state, isIdle: false };
    }
    return state;
  }

  const elapsedMs = currentTimestampMs - state.lastActiveTimestampMs;
  const shouldBeIdle = elapsedMs >= state.idleThresholdMs;

  if (shouldBeIdle !== state.isIdle) {
    return {
      ...state,
      isIdle: shouldBeIdle,
    };
  }

  return state;
}

/**
 * Returns target frame rate for rendering loop based on idle status.
 */
export function resolveTargetFrameRate(state: IdlePowerState): number {
  return state.isIdle ? state.throttledFrameRate : state.activeFrameRate;
}

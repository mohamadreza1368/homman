import { describe, it, expect } from 'vitest';
import {
  createIdlePowerState,
  recordUserActivity,
  evaluateIdleTransition,
  resolveTargetFrameRate,
  MIN_ALLOWED_THRESHOLD_MS,
} from './idleEngine';

describe('IdleEngine (Spec verification from specs/idle-power-conservation.md)', () => {
  it('Scenario 1: enters idle state and throttles FPS when inactivity exceeds threshold', () => {
    const start = 100_000;
    let state = createIdlePowerState({ idleThresholdMs: 60_000 }, start);

    expect(state.isIdle).toBe(false);
    expect(resolveTargetFrameRate(state)).toBe(60);

    // After 60,001 ms of inactivity
    state = evaluateIdleTransition(state, start + 60_001);
    expect(state.isIdle).toBe(true);
    expect(resolveTargetFrameRate(state)).toBe(15);
  });

  it('Scenario 2: instantly awakens and restores 60 FPS upon user interaction', () => {
    const start = 100_000;
    let state = createIdlePowerState({ idleThresholdMs: 60_000 }, start);
    state = evaluateIdleTransition(state, start + 70_000);
    expect(state.isIdle).toBe(true);

    // User touches or clicks at t = 175,000
    state = recordUserActivity(state, 175_000);
    expect(state.isIdle).toBe(false);
    expect(state.lastActiveTimestampMs).toBe(175_000);
    expect(resolveTargetFrameRate(state)).toBe(60);
  });

  it('Scenario 3: maintains active status and 60 FPS when idle throttling is disabled (threshold = 0)', () => {
    const start = 100_000;
    let state = createIdlePowerState({ idleThresholdMs: 0 }, start);

    // 300,000 ms elapsed
    state = evaluateIdleTransition(state, start + 300_000);
    expect(state.isIdle).toBe(false);
    expect(resolveTargetFrameRate(state)).toBe(60);
  });

  it('Edge Case A: rapid continuous user activity updates timestamp cleanly', () => {
    let state = createIdlePowerState({ idleThresholdMs: 60_000 }, 1000);
    state = recordUserActivity(state, 1010);
    state = recordUserActivity(state, 1020);
    state = recordUserActivity(state, 1030);

    expect(state.lastActiveTimestampMs).toBe(1030);
    expect(state.isIdle).toBe(false);
  });

  it('Edge Case B: clamps negative idle thresholds to safe minimum', () => {
    const state = createIdlePowerState({ idleThresholdMs: -5000 });
    expect(state.idleThresholdMs).toBe(MIN_ALLOWED_THRESHOLD_MS);
  });

  it('Edge Case C: immediately forces idle when document is hidden in background tab', () => {
    const start = 100_000;
    let state = createIdlePowerState({ idleThresholdMs: 60_000 }, start);
    expect(state.isIdle).toBe(false);

    // Document switches to hidden
    state = evaluateIdleTransition(state, start + 1000, true);
    expect(state.isIdle).toBe(true);
    expect(resolveTargetFrameRate(state)).toBe(15);
  });
});

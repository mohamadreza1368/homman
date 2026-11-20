import { describe, it, expect } from 'vitest';
import {
  createInitialTourState,
  advanceTourStep,
  retreatTourStep,
  dismissTour,
  relaunchTour,
} from './guidedTourEngine';

describe('GuidedTourEngine (Spec verification from specs/guided-tour-onboarding.md)', () => {
  it('Scenario 1: advances to next step while maintaining open state', () => {
    let state = createInitialTourState(4, false);
    expect(state.currentStepIndex).toBe(0);
    expect(state.isOpen).toBe(true);

    state = advanceTourStep(state);
    expect(state.currentStepIndex).toBe(1);
    expect(state.isOpen).toBe(true);
    expect(state.hasCompletedOnboarding).toBe(false);
  });

  it('Scenario 2: finishes tour on completing last step and marks completed', () => {
    let state = createInitialTourState(4, false);
    state = advanceTourStep(state); // step 1
    state = advanceTourStep(state); // step 2
    state = advanceTourStep(state); // step 3 (last step)

    expect(state.currentStepIndex).toBe(3);
    expect(state.isOpen).toBe(true);

    state = advanceTourStep(state); // completes
    expect(state.isOpen).toBe(false);
    expect(state.hasCompletedOnboarding).toBe(true);
  });

  it('Scenario 3: clamps retreat to step 0 when at beginning', () => {
    let state = createInitialTourState(4, false);
    expect(state.currentStepIndex).toBe(0);

    state = retreatTourStep(state);
    expect(state.currentStepIndex).toBe(0);
  });

  it('Edge Case A: rapid calls do not overflow beyond final step', () => {
    let state = createInitialTourState(2, false);
    state = advanceTourStep(state); // 1
    state = advanceTourStep(state); // closed
    state = advanceTourStep(state); // already closed

    expect(state.isOpen).toBe(false);
    expect(state.currentStepIndex).toBe(1);
  });

  it('Edge Case B: dismisses tour mid-way and preserves completed status', () => {
    let state = createInitialTourState(4, false);
    state = advanceTourStep(state); // at step 1
    state = dismissTour(state);

    expect(state.isOpen).toBe(false);
    expect(state.hasCompletedOnboarding).toBe(true);
  });

  it('Edge Case C: relaunch restarts tour from step 0', () => {
    let state = createInitialTourState(4, true); // already completed, closed
    expect(state.isOpen).toBe(false);

    state = relaunchTour(state);
    expect(state.isOpen).toBe(true);
    expect(state.currentStepIndex).toBe(0);
  });
});

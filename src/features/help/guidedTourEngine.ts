/**
 * Interactive Guided Tour & Onboarding Engine
 *
 * Implemented strictly from specs/guided-tour-onboarding.md
 * Independent Clean-Room implementation for tour navigation,
 * step clamping, and onboarding completion lifecycle.
 */

export interface TourStepDefinition {
  readonly id: string;
  readonly titleFa: string;
  readonly descriptionFa: string;
  readonly targetElementSelector?: string;
}

export interface TourNavigationState {
  readonly isOpen: boolean;
  readonly currentStepIndex: number;
  readonly hasCompletedOnboarding: boolean;
  readonly totalSteps: number;
}

/**
 * Initializes tour state. If previously completed, tour defaults to closed.
 */
export function createInitialTourState(
  totalSteps: number,
  previouslyCompleted: boolean = false
): TourNavigationState {
  return {
    isOpen: !previouslyCompleted,
    currentStepIndex: 0,
    hasCompletedOnboarding: previouslyCompleted,
    totalSteps: Math.max(1, totalSteps),
  };
}

/**
 * Advances to the next tour step or finishes the tour if already on the final step.
 */
export function advanceTourStep(state: TourNavigationState): TourNavigationState {
  if (!state.isOpen) return state;

  const nextIndex = state.currentStepIndex + 1;
  if (nextIndex >= state.totalSteps) {
    return {
      ...state,
      isOpen: false,
      hasCompletedOnboarding: true,
      currentStepIndex: state.totalSteps - 1,
    };
  }

  return {
    ...state,
    currentStepIndex: nextIndex,
  };
}

/**
 * Steps backward, clamping at index 0.
 */
export function retreatTourStep(state: TourNavigationState): TourNavigationState {
  if (!state.isOpen) return state;

  return {
    ...state,
    currentStepIndex: Math.max(0, state.currentStepIndex - 1),
  };
}

/**
 * Closes the tour prematurely and marks it as completed so it does not auto-reopen.
 */
export function dismissTour(state: TourNavigationState): TourNavigationState {
  return {
    ...state,
    isOpen: false,
    hasCompletedOnboarding: true,
  };
}

/**
 * Relaunches tour from step 0 upon explicit user request (e.g. clicking Help).
 */
export function relaunchTour(state: TourNavigationState): TourNavigationState {
  return {
    ...state,
    isOpen: true,
    currentStepIndex: 0,
  };
}

/**
 * HOOMAAN Hologram - Deployment Timeline & Animation Interpolation
 */

export const TIMELINE = {
  bootDuration: 1.1,
  deployDuration: 2.4,
  materializeDuration: 1.4,
} as const;

export const TOTAL_INTRO_SPAN =
  TIMELINE.bootDuration + TIMELINE.deployDuration + TIMELINE.materializeDuration;

function smoothInterpolate(val: number): number {
  const norm = Math.min(1, Math.max(0, val));
  return norm * norm * (3 - 2 * norm);
}

export interface IntroPhases {
  bootPhase: number;
  deployPhase: number;
  materializePhase: number;
}

export function evaluateIntroPhases(elapsedTimeSec: number): IntroPhases {
  const bootPhase = smoothInterpolate(elapsedTimeSec / TIMELINE.bootDuration);
  const deployPhase = smoothInterpolate(
    (elapsedTimeSec - TIMELINE.bootDuration) / TIMELINE.deployDuration,
  );
  const materializePhase = smoothInterpolate(
    (elapsedTimeSec - TIMELINE.bootDuration - TIMELINE.deployDuration) /
      TIMELINE.materializeDuration,
  );

  return {
    bootPhase,
    deployPhase,
    materializePhase,
  };
}

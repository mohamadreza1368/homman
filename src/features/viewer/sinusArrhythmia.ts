import type { BreathPattern } from "./breathing";

const SETTLING_WINDOW_SECS = 3.0;
const MINIMUM_REST_FRACTION = 0.2;
const MIN_SPEED_RATIO = 0.5;
const MAX_SPEED_RATIO = 2.0;

export function sinusPace(
  elapsedTime: number,
  breathModel: Pick<BreathPattern, "period">
): number {
  const cycleTime = breathModel.period;
  const wrapped = ((elapsedTime % cycleTime) + cycleTime) % cycleTime;
  const normalizedPhase = (2 * Math.PI * wrapped) / cycleTime;
  return -Math.cos(normalizedPhase);
}

export class BreathPacer {
  private currentShare = 0.5;

  public advance(dt: number, excursion: number, isResting: boolean): number {
    const target = isResting ? 1.0 : 0.0;
    const alpha = Math.min(1.0, dt / SETTLING_WINDOW_SECS);
    this.currentShare += (target - this.currentShare) * alpha;

    if (!isResting || excursion === 0) {
      return dt;
    }

    const baseline = Math.max(MINIMUM_REST_FRACTION, this.currentShare);
    const speedRatio = 1.0 + excursion / baseline;
    const boundedRatio = Math.max(MIN_SPEED_RATIO, Math.min(MAX_SPEED_RATIO, speedRatio));

    return dt * boundedRatio;
  }

  public reset(): void {
    this.currentShare = 0.5;
  }
}

export function breathNote(couplingDegree: number): string {
  if (couplingDegree <= 0) {
    return "Breathing on: this rhythm does not follow it — the sinus node is not what paces the ventricles.";
  }

  const primaryDescription =
    "Breathing on: the rate rises as the breath comes in and falls as it goes out — sinus " +
    "arrhythmia, normal and largest in the young. Watch the gaps between beats on the trace.";

  return couplingDegree < 1
    ? `${primaryDescription} At this rate it is small.`
    : primaryDescription;
}

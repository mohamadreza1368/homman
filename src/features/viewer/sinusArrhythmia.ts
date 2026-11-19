/**
 * Hoomaan 3D Viewer - Respiratory Sinus Arrhythmia Modulation
 */

import type { BreathPattern } from "./breathing";

/**
 * Calculates phase modulation (-1 to 1) of the sinus node based on respiratory cycle.
 */
export function sinusPace(seconds: number, pattern: Pick<BreathPattern, "period">): number {
  const period = pattern.period;
  const phase = (((seconds % period) + period) % period) / period;
  return -Math.cos(2 * Math.PI * phase);
}

const SHARE_SETTLE_S = 3;
const MIN_SHARE = 0.2;
const SLOWEST = 0.5;
const FASTEST = 2;

/**
 * Modulates frame step interval dynamically according to respiratory phase and cardiac resting share.
 */
export class BreathPacer {
  private share = 0.5;

  advance(step: number, swing: number, resting: boolean): number {
    this.share += ((resting ? 1 : 0) - this.share) * Math.min(1, step / SHARE_SETTLE_S);
    if (!resting || swing === 0) return step;
    const speed = 1 + swing / Math.max(MIN_SHARE, this.share);
    return step * Math.min(FASTEST, Math.max(SLOWEST, speed));
  }

  reset(): void {
    this.share = 0.5;
  }
}

/** Formats descriptive status explanation of respiratory sinus coupling for UI panels. */
export function breathNote(followsBreath: number): string {
  if (followsBreath <= 0) {
    return "Breathing on: this rhythm does not follow it — the sinus node is not what paces the ventricles.";
  }
  const note =
    "Breathing on: the rate rises as the breath comes in and falls as it goes out — sinus " +
    "arrhythmia, normal and largest in the young. Watch the gaps between beats on the trace.";
  return followsBreath < 1 ? `${note} At this rate it is small.` : note;
}

/**
 * Hoomaan 3D Viewer - Photosensitive Epilepsy Light Flashing Protection
 */

/** Maximum safe pulsation frequency in Hertz (WCAG threshold: 3.0 Hz). */
export const SAFE_FLASH_HZ = 2.5;

const WINDOW_S = 2;
const STEADY_SETTLE_S = 0.8;

export class LightGuard {
  private rises: number[] = [];
  private above = false;
  private low = 0;
  private high = 0;
  private mean = 0;
  steady = false;

  /**
   * Filters raw pulsation values, holding steady if flash rate exceeds safety limit.
   */
  next(now: number, step: number, raw: number, calm = false): number {
    const relax = Math.min(1, step / WINDOW_S);
    this.high = Math.max(raw, this.high + (raw - this.high) * relax);
    this.low = Math.min(raw, this.low + (raw - this.low) * relax);

    const mid = (this.high + this.low) / 2;
    const range = this.high - this.low;

    const isAbove = range > 0.05 && raw > mid;
    if (isAbove && !this.above) {
      this.rises.push(now);
    }
    this.above = isAbove;

    while (this.rises.length > 0 && now - this.rises[0]! > WINDOW_S) {
      this.rises.shift();
    }

    this.mean += (raw - this.mean) * Math.min(1, step / STEADY_SETTLE_S);

    const count = this.rises.length;
    const duration = count >= 2 ? this.rises[count - 1]! - this.rises[0]! : 0;
    this.steady = calm || (duration > 0 && (count - 1) / duration >= SAFE_FLASH_HZ);

    return this.steady ? this.mean : raw;
  }

  /** Clears accumulated pulses and resets guard to default state. */
  reset(): void {
    this.rises = [];
    this.above = false;
    this.low = 0;
    this.high = 0;
    this.mean = 0;
    this.steady = false;
  }
}

/** Detects OS prefers-reduced-motion accessibility preference. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

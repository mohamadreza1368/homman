/**
 * Hoomaan Vascular Hemodynamics & Ejection Pulse Engine
 *
 * Models systolic wave propagation and systemic venous blood return.
 * Derived purely from specs/vascular-flow.md.
 */

export interface PulseWaveRecord {
  launchTime: number;
  strength: number;
}

export const MAX_CONCURRENT_PULSES = 8;
export const VALVE_EJECTION_DELAY = 0.06;
export const PULSE_SURVIVAL_LIFETIME = 3.0;

export class VascularHemodynamicsEngine {
  private waves: PulseWaveRecord[] = [];
  public venousFlowLevel = 0;

  /**
   * Registers a new systolic pulse into the arterial tree.
   */
  emitSystolicEjection(timestamp: number, force: number): void {
    if (force <= 0) return;

    const newWave: PulseWaveRecord = {
      launchTime: timestamp + VALVE_EJECTION_DELAY,
      strength: Math.min(1.0, force),
    };

    this.waves.push(newWave);

    // Bounded buffer capacity
    if (this.waves.length > MAX_CONCURRENT_PULSES) {
      this.waves.splice(0, this.waves.length - MAX_CONCURRENT_PULSES);
    }
  }

  /**
   * Advances fluid simulation time step and updates aged wave buffers and venous fill level.
   */
  stepSimulation(
    currentTime: number,
    deltaSeconds: number,
    outputAges: Float32Array,
    outputStrengths: Float32Array,
  ): void {
    // Purge expired pulses
    this.waves = this.waves.filter(
      (w) => currentTime - w.launchTime < PULSE_SURVIVAL_LIFETIME,
    );

    // Compute recent active output energy across a 3.0 second window
    let recentEnergySum = 0;
    for (const w of this.waves) {
      if (w.launchTime <= currentTime && currentTime - w.launchTime < 3.0) {
        recentEnergySum += w.strength;
      }
    }

    const nominalExpectedPulses = (72 / 60) * 3.0; // ~3.6 pulses in window at resting 72 bpm
    const targetVenousReturn = Math.min(1.0, recentEnergySum / nominalExpectedPulses);

    // Smooth venous settling
    const settlingRate = Math.min(1.0, deltaSeconds / 1.5);
    this.venousFlowLevel += (targetVenousReturn - this.venousFlowLevel) * settlingRate;

    // Fill output buffers
    for (let slot = 0; slot < MAX_CONCURRENT_PULSES; slot++) {
      const pulse = this.waves[slot];
      if (pulse) {
        outputAges[slot] = currentTime - pulse.launchTime;
        outputStrengths[slot] = pulse.strength;
      } else {
        outputAges[slot] = -1.0;
        outputStrengths[slot] = 0.0;
      }
    }
  }

  get activeWaveCount(): number {
    return this.waves.length;
  }

  reset(): void {
    this.waves = [];
    this.venousFlowLevel = 0;
  }
}

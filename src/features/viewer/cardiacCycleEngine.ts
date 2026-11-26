/**
 * Hoomaan Cardiac Kinematics & Waveform Generation Engine
 *
 * Implements chamber squeeze curves, cardiac timing cycles, and synthetic ECG waveforms.
 * Derived purely from specs/cardiac-motion-ecg.md.
 */

export interface CardiacKinematics {
  atrialContraction: number;
  ventricularContraction: number;
}

export type HeartRateMode =
  | "normal"
  | "tachycardia"
  | "bradycardia"
  | "asystole"
  | "ventricular_fibrillation";

const MAX_SQUEEZE_MAGNITUDE = 0.08;

// Nominal cardiac timing relative to a 1.0 normalized cycle
const ATRIAL_CYCLE = { onset: 0.0, peak: 0.05, conclusion: 0.12 };
const VENTRICULAR_CYCLE = { onset: 0.14, peak: 0.26, conclusion: 0.44 };

/**
 * Physiological rapid ejection acceleration (Guyton & Hall 2026, Ch. 9).
 */
function interpolateAscending(val: number): number {
  const clamped = Math.min(1, Math.max(0, val));
  return Math.pow(Math.sin(clamped * Math.PI * 0.5), 1.3);
}

/**
 * Early rapid diastolic relaxation with elastic recoil settling into diastasis.
 */
function interpolateDescending(val: number): number {
  const clamped = Math.min(1, Math.max(0, val));
  return Math.pow(1 - clamped, 2) * (1 + clamped * 1.5);
}

/**
 * Computes instantaneous chamber squeeze magnitudes for a given elapsed time.
 */
export function evaluateChamberKinematics(
  elapsedSeconds: number,
  mode: HeartRateMode = "normal",
): CardiacKinematics {
  if (mode === "asystole") {
    return { atrialContraction: 0, ventricularContraction: 0 };
  }

  if (mode === "ventricular_fibrillation") {
    // Uncoordinated quivering that never reaches full contraction nor complete relaxation
    const tremor = 0.02 + 0.015 * Math.sin(2 * Math.PI * 12.0 * elapsedSeconds);
    return { atrialContraction: 0.01, ventricularContraction: tremor };
  }

  const beatsPerMinute = mode === "tachycardia" ? 130 : mode === "bradycardia" ? 45 : 72;
  const cyclePeriod = 60 / beatsPerMinute;
  const cycleTime = ((elapsedSeconds % cyclePeriod) + cyclePeriod) % cyclePeriod;

  // Evaluate atrial squeeze curve
  let atrialFactor = 0;
  if (cycleTime > ATRIAL_CYCLE.onset && cycleTime < ATRIAL_CYCLE.conclusion) {
    if (cycleTime <= ATRIAL_CYCLE.peak) {
      atrialFactor = interpolateAscending(
        (cycleTime - ATRIAL_CYCLE.onset) / (ATRIAL_CYCLE.peak - ATRIAL_CYCLE.onset),
      );
    } else {
      atrialFactor = interpolateDescending(
        (cycleTime - ATRIAL_CYCLE.peak) / (ATRIAL_CYCLE.conclusion - ATRIAL_CYCLE.peak),
      );
    }
  }

  // Evaluate ventricular squeeze curve
  let ventricularFactor = 0;
  if (cycleTime > VENTRICULAR_CYCLE.onset && cycleTime < VENTRICULAR_CYCLE.conclusion) {
    if (cycleTime <= VENTRICULAR_CYCLE.peak) {
      ventricularFactor = interpolateAscending(
        (cycleTime - VENTRICULAR_CYCLE.onset) /
          (VENTRICULAR_CYCLE.peak - VENTRICULAR_CYCLE.onset),
      );
    } else {
      ventricularFactor = interpolateDescending(
        (cycleTime - VENTRICULAR_CYCLE.peak) /
          (VENTRICULAR_CYCLE.conclusion - VENTRICULAR_CYCLE.peak),
      );
    }
  }

  return {
    atrialContraction: MAX_SQUEEZE_MAGNITUDE * atrialFactor,
    ventricularContraction: MAX_SQUEEZE_MAGNITUDE * ventricularFactor,
  };
}

/**
 * Calculates synthetic ECG lead voltage value for a given timestamp.
 */
export function evaluateEcgSignalVoltage(
  elapsedSeconds: number,
  mode: HeartRateMode = "normal",
): number {
  if (mode === "asystole") {
    return 0.0;
  }

  const cyclePeriod = 60 / 72;
  const t = ((elapsedSeconds % cyclePeriod) + cyclePeriod) % cyclePeriod;

  // Gaussian pulses for P, Q, R, S, T waves
  const gaussian = (center: number, width: number, amp: number) => {
    const diff = (t - center) / width;
    return amp * Math.exp(-diff * diff);
  };

  const pWave = gaussian(0.04, 0.02, 0.15); // Atrial depolarization
  const qWave = gaussian(0.18, 0.008, -0.12);
  const rWave = gaussian(0.20, 0.012, 1.0); // Ventricular main peak
  const sWave = gaussian(0.22, 0.009, -0.25);
  const tWave = gaussian(0.36, 0.05, 0.3); // Ventricular repolarization

  return pWave + qWave + rWave + sWave + tWave;
}

/**
 * Hoomaan 3D Anatomy - Cardiac Rhythm Catalog & Physiological Pacer
 * 
 * Clean-room implementation based on cardiac electrophysiology specifications.
 * Defines heart rhythms, conduction blocks, murmurs, and hemodynamic timing.
 */

import { CYCLE, RESTING_BPM } from "./heartbeat";
import type {
  MurmurShape,
  Planned,
  Planner,
  RhythmDefinition,
} from "./rhythmTypes";

// ---------------------------------------------------------------------------
// Electrophysiological Timing Constants
// ---------------------------------------------------------------------------

export const KINEMATICS = Object.freeze({
  atrialDuration: CYCLE.atria.end - CYCLE.atria.start,
  atrialPeakOffset: CYCLE.atria.peak - CYCLE.atria.start,
  prInterval: CYCLE.ventricles.start - CYCLE.atria.start,
  systoleBaseDuration: CYCLE.ventricles.end - CYCLE.ventricles.start,
  systolePeakRatio:
    (CYCLE.ventricles.peak - CYCLE.ventricles.start) /
    (CYCLE.ventricles.end - CYCLE.ventricles.start),
  s2Fraction:
    (CYCLE.s2 - CYCLE.ventricles.start) /
    (CYCLE.ventricles.end - CYCLE.ventricles.start),
  rrIntervalNominal: 60 / RESTING_BPM,
});

/**
 * Calculates systolic duration using Bazett's square-root RR scaling.
 */
export function systoleFor(rrInterval: number): number {
  const scaled =
    KINEMATICS.systoleBaseDuration *
    Math.sqrt(Math.max(0.2, rrInterval) / KINEMATICS.rrIntervalNominal);
  return Math.min(0.36, Math.max(0.16, scaled));
}

// ---------------------------------------------------------------------------
// Event Generators
// ---------------------------------------------------------------------------

function pushAtrium(plan: Planned, at: number, strength = 1): void {
  plan.atria.push({
    at,
    peak: at + KINEMATICS.atrialPeakOffset,
    end: at + KINEMATICS.atrialDuration,
    strength,
  });
}

function pushVentricle(
  plan: Planned,
  at: number,
  rr: number,
  opts?: {
    strength?: number;
    s1Level?: number;
    s2Level?: number;
    wide?: boolean;
  },
): void {
  const strength = opts?.strength ?? 1;
  const s1Level = opts?.s1Level ?? 1;
  const s2Level = opts?.s2Level ?? 1;
  const wide = opts?.wide ?? false;

  const dur = systoleFor(rr);
  plan.ventricles.push({
    at,
    peak: at + dur * KINEMATICS.systolePeakRatio,
    end: at + dur,
    strength,
    wide,
  });

  if (s1Level > 0) {
    plan.lub.push({ at, level: s1Level });
  }
  if (s2Level > 0) {
    plan.dub.push({ at: at + dur * KINEMATICS.s2Fraction, level: s2Level });
  }
}

// ---------------------------------------------------------------------------
// Scheduler Factories
// ---------------------------------------------------------------------------

function buildSinusScheduler(bpm: number, prDelay: number): Planner {
  const interval = 60 / bpm;
  return (horizon, clocks, _rng, plan) => {
    let atria = clocks.atria ?? 0;
    while (atria < horizon) {
      pushAtrium(plan, atria);
      pushVentricle(plan, atria + prDelay, interval);
      atria += interval;
    }
    clocks.atria = atria;
  };
}

interface AuscultationBeats {
  s1: number;
  s2: number;
  nextS1: number;
}

function buildAuscultationScheduler(
  builder: (beats: AuscultationBeats, plan: Planned) => void,
): Planner {
  const interval = KINEMATICS.rrIntervalNominal;
  const systoleDuration = systoleFor(interval);

  return (horizon, clocks, _rng, plan) => {
    let atria = clocks.atria ?? 0;
    while (atria < horizon) {
      const s1Time = atria + KINEMATICS.prInterval;
      pushAtrium(plan, atria);
      pushVentricle(plan, s1Time, interval);

      builder(
        {
          s1: s1Time,
          s2: s1Time + systoleDuration * KINEMATICS.s2Fraction,
          nextS1: s1Time + interval,
        },
        plan,
      );

      atria += interval;
    }
    clocks.atria = atria;
  };
}

// ---------------------------------------------------------------------------
// RHYTHMS Master Registry
// ---------------------------------------------------------------------------

export const RHYTHMS: readonly RhythmDefinition[] = [
  // --- Sinus Group ---
  {
    id: "normal",
    label: "Normal sinus rhythm",
    group: "Sinus",
    rate: "72 bpm",
    what: "Physiological pace driven from SA node through typical AV conduction.",
    quiver: { atria: 0, ventricles: 0 },
    followsBreath: 0.08,
    plan: buildSinusScheduler(RESTING_BPM, KINEMATICS.prInterval),
  },
  {
    id: "sinus_tachycardia",
    label: "Sinus tachycardia",
    group: "Sinus",
    rate: "130 bpm",
    what: "Elevated SA node firing rate exceeding 100 beats per minute.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildSinusScheduler(130, 0.12),
  },
  {
    id: "sinus_bradycardia",
    label: "Sinus bradycardia",
    group: "Sinus",
    rate: "45 bpm",
    what: "Slow SA node pacing below 60 bpm with extended diastolic rest periods.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildSinusScheduler(45, 0.16),
  },

  // --- Conduction Blocks ---
  {
    id: "av_block_1",
    label: "First-degree AV block",
    group: "Conduction blocks",
    rate: "72 bpm",
    what: "Fixed PR interval prolongation greater than 0.20 seconds with preserved conduction.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildSinusScheduler(RESTING_BPM, 0.32),
  },
  {
    id: "mobitz_1",
    label: "Mobitz I (Wenckebach)",
    group: "Conduction blocks",
    rate: "Irregular (~55 bpm)",
    what: "Progressive PR prolongation ending in an unconducted P wave and dropped ventricular beat.",
    quiver: { atria: 0, ventricles: 0 },
    plan: (horizon, clocks, _rng, plan) => {
      const baseRR = KINEMATICS.rrIntervalNominal;
      let atria = clocks.atria ?? 0;
      let beat = clocks.beat ?? 0;

      while (atria < horizon) {
        const step = (beat % 4) as 0 | 1 | 2 | 3;
        const delays: readonly [number, number, number, number] = [0.16, 0.22, 0.28, 0];
        const pr = delays[step];

        pushAtrium(plan, atria);
        if (step !== 3) {
          pushVentricle(plan, atria + pr, baseRR);
        }

        atria += baseRR;
        beat += 1;
      }

      clocks.atria = atria;
      clocks.beat = beat;
    },
  },
  {
    id: "mobitz_2",
    label: "Mobitz II",
    group: "Conduction blocks",
    rate: "48 bpm (2:1 block)",
    what: "Constant PR interval with intermittent abrupt failure of AV conduction.",
    quiver: { atria: 0, ventricles: 0 },
    plan: (horizon, clocks, _rng, plan) => {
      const atriaStep = 60 / 96;
      let atria = clocks.atria ?? 0;
      let beat = clocks.beat ?? 0;

      while (atria < horizon) {
        pushAtrium(plan, atria);
        if (beat % 2 === 0) {
          pushVentricle(plan, atria + KINEMATICS.prInterval, atriaStep * 2);
        }
        atria += atriaStep;
        beat += 1;
      }

      clocks.atria = atria;
      clocks.beat = beat;
    },
  },
  {
    id: "av_block_3",
    label: "Third-degree AV block",
    group: "Conduction blocks",
    rate: "Ventricular 35 bpm / Atrial 80 bpm",
    what: "Complete AV dissociation; slow ventricular escape rhythm with wide QRS complexes.",
    quiver: { atria: 0, ventricles: 0 },
    plan: (horizon, clocks, _rng, plan) => {
      const atriaInterval = 60 / 80;
      const ventInterval = 60 / 35;
      let atria = clocks.atria ?? 0;
      let ventricles = clocks.ventricles ?? (atria + 0.1);

      while (atria < horizon) {
        pushAtrium(plan, atria);
        atria += atriaInterval;
      }

      while (ventricles < horizon) {
        pushVentricle(plan, ventricles, ventInterval, {
          strength: 0.9,
          s1Level: 0.7,
          s2Level: 0.7,
          wide: true,
        });
        ventricles += ventInterval;
      }

      clocks.atria = atria;
      clocks.ventricles = ventricles;
    },
  },

  // --- Atrial Arrhythmias ---
  {
    id: "atrial_fibrillation",
    label: "Atrial fibrillation",
    group: "Atrial",
    rate: "Irregular (110-150 bpm)",
    what: "Atria quiver; ventricular response is irregularly irregular with absent P waves.",
    quiver: { atria: 1, ventricles: 0 },
    atrialTrace: "fibrillation",
    plan: (horizon, clocks, rng, plan) => {
      let ventricles = clocks.ventricles ?? (clocks.atria ?? 0);
      while (ventricles < horizon) {
        const randomRR = 0.35 + rng() * 0.35;
        const amp = 0.65 + rng() * 0.35;
        pushVentricle(plan, ventricles, randomRR, {
          strength: amp,
          s1Level: amp,
          s2Level: amp,
        });
        ventricles += randomRR;
      }
      clocks.ventricles = ventricles;
    },
  },
  {
    id: "atrial_flutter",
    label: "Atrial flutter",
    group: "Atrial",
    rate: "Atrial 300 bpm / Ventricular 150 bpm (2:1)",
    what: "Macro-reentrant atrial circuit presenting characteristic sawtooth flutter waves.",
    quiver: { atria: 0.35, ventricles: 0 },
    atrialTrace: "flutter",
    plan: (horizon, clocks, _rng, plan) => {
      const flutterCycle = 60 / 300;
      let atria = clocks.atria ?? 0;
      let beat = clocks.beat ?? 0;

      while (atria < horizon) {
        pushAtrium(plan, atria, 0.45);
        if (beat % 2 === 0) {
          pushVentricle(plan, atria + 0.08, flutterCycle * 2);
        }
        atria += flutterCycle;
        beat += 1;
      }

      clocks.atria = atria;
      clocks.beat = beat;
    },
  },

  // --- Ventricular Arrhythmias ---
  {
    id: "premature_ventricular",
    label: "Premature ventricular contraction",
    group: "Ventricular",
    rate: "Sinus with ectopic beats",
    what: "Ectopic ventricular impulse followed by a full compensatory pause.",
    quiver: { atria: 0, ventricles: 0 },
    plan: (horizon, clocks, _rng, plan) => {
      const baseRR = KINEMATICS.rrIntervalNominal;
      let atria = clocks.atria ?? 0;
      let beat = clocks.beat ?? 0;

      while (atria < horizon) {
        const isPvcCycle = beat % 5 === 4;

        if (isPvcCycle) {
          pushAtrium(plan, atria);
          const pvcTime = atria + 0.35;
          pushVentricle(plan, pvcTime, baseRR * 0.6, {
            strength: 1.15,
            s1Level: 1.3,
            s2Level: 0.4,
            wide: true,
          });
          atria += baseRR * 1.5;
        } else {
          pushAtrium(plan, atria);
          pushVentricle(plan, atria + KINEMATICS.prInterval, baseRR);
          atria += baseRR;
        }
        beat += 1;
      }

      clocks.atria = atria;
      clocks.beat = beat;
    },
  },
  {
    id: "ventricular_tachycardia",
    label: "Ventricular tachycardia",
    group: "Ventricular",
    rate: "160 bpm (wide complex)",
    what: "Rapid ventricular pacing with broad QRS complexes and severe hemodynamic compromise.",
    quiver: { atria: 0, ventricles: 0.2 },
    plan: (horizon, clocks, _rng, plan) => {
      const vtCycle = 60 / 160;
      let ventricles = clocks.ventricles ?? (clocks.atria ?? 0);

      while (ventricles < horizon) {
        pushVentricle(plan, ventricles, vtCycle, {
          strength: 0.75,
          s1Level: 0.8,
          s2Level: 0.5,
          wide: true,
        });
        ventricles += vtCycle;
      }

      clocks.ventricles = ventricles;
    },
  },
  {
    id: "ventricular_fibrillation",
    label: "Ventricular fibrillation",
    group: "Ventricular",
    rate: "Chaotic (no effective output)",
    what: "Disorganized ventricular excitation producing zero stroke volume; requires defibrillation.",
    quiver: { atria: 0.2, ventricles: 1 },
    plan: (horizon, clocks, _rng, _plan) => {
      clocks.atria = horizon;
    },
  },
  {
    id: "asystole",
    label: "Asystole",
    group: "Ventricular",
    rate: "0 bpm (flatline)",
    what: "Complete cessation of cardiac electrical and mechanical activity.",
    quiver: { atria: 0, ventricles: 0 },
    plan: (horizon, clocks, _rng, _plan) => {
      clocks.atria = horizon;
    },
  },

  // --- Murmurs and Extra Sounds ---
  {
    id: "aortic_stenosis",
    label: "Aortic stenosis",
    group: "Murmurs and extra sounds",
    rate: "72 bpm",
    what: "Harsh crescendo-decrescendo diamond systolic ejection murmur at the right upper sternal border.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildAuscultationScheduler(({ s1, s2 }, plan) => {
      const duration = s2 - s1;
      plan.murmurs.push({
        at: s1 + 0.04,
        length: Math.max(0.08, duration - 0.06),
        shape: "diamond" as MurmurShape,
        pitch: 280,
        q: 4,
        level: 0.85,
      });
    }),
  },
  {
    id: "mitral_regurgitation",
    label: "Mitral regurgitation",
    group: "Murmurs and extra sounds",
    rate: "72 bpm",
    what: "Holosystolic plateau murmur radiating from the apex towards the axilla.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildAuscultationScheduler(({ s1, s2 }, plan) => {
      plan.murmurs.push({
        at: s1,
        length: s2 - s1,
        shape: "plateau" as MurmurShape,
        pitch: 340,
        q: 3,
        level: 0.75,
      });
    }),
  },
  {
    id: "aortic_regurgitation",
    label: "Aortic regurgitation",
    group: "Murmurs and extra sounds",
    rate: "72 bpm",
    what: "Early diastolic decrescendo blowing murmur best heard at Erb's point.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildAuscultationScheduler(({ s2, nextS1 }, plan) => {
      const diastoleDuration = nextS1 - s2;
      plan.murmurs.push({
        at: s2,
        length: diastoleDuration * 0.7,
        shape: "decrescendo" as MurmurShape,
        pitch: 420,
        q: 2.5,
        level: 0.7,
      });
    }),
  },
  {
    id: "mitral_stenosis",
    label: "Mitral stenosis",
    group: "Murmurs and extra sounds",
    rate: "72 bpm",
    what: "Opening snap followed by a low-pitched mid-diastolic rumbling murmur with presystolic accentuation.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildAuscultationScheduler(({ s2, nextS1 }, plan) => {
      const snapAt = s2 + 0.08;
      plan.extras.push({ at: snapAt, kind: "snap" });
      plan.murmurs.push({
        at: snapAt + 0.03,
        length: (nextS1 - snapAt) * 0.75,
        shape: "rumble" as MurmurShape,
        pitch: 130,
        q: 5,
        level: 0.65,
      });
    }),
  },
  {
    id: "third_heart_sound",
    label: "Third heart sound (S3)",
    group: "Murmurs and extra sounds",
    rate: "72 bpm",
    what: "Ventricular gallop occurring in early diastole during passive ventricular filling.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildAuscultationScheduler(({ s2 }, plan) => {
      plan.extras.push({ at: s2 + 0.15, kind: "s3" });
    }),
  },
  {
    id: "fourth_heart_sound",
    label: "Fourth heart sound (S4)",
    group: "Murmurs and extra sounds",
    rate: "72 bpm",
    what: "Atrial gallop occurring in late diastole immediately prior to S1 due to stiff ventricles.",
    quiver: { atria: 0, ventricles: 0 },
    plan: buildAuscultationScheduler(({ nextS1 }, plan) => {
      plan.extras.push({ at: nextS1 - 0.11, kind: "s4" });
    }),
  },
] as const;


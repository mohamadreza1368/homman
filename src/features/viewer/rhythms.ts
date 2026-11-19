/**
 * Hoomaan 3D Viewer - Heart Rhythms, Cardiac Conduction & Murmur Synthesis
 */

import type { HeartRhythmId } from "@/lib/schemas";
import { CYCLE, RESTING_BPM, SQUEEZE } from "./heartbeat";

export type RhythmId = HeartRhythmId;

export const RHYTHM_GROUPS = [
  "Sinus",
  "Conduction blocks",
  "Atrial",
  "Ventricular",
  "Murmurs and extra sounds",
] as const;

export type RhythmGroup = (typeof RHYTHM_GROUPS)[number];

export interface Contraction {
  at: number;
  peak: number;
  end: number;
  strength: number;
  wide?: boolean;
}

export type AtrialTrace = "p" | "flutter" | "fibrillation";

export interface HeartSound {
  at: number;
  level: number;
}

export type MurmurShape = "diamond" | "plateau" | "decrescendo" | "rumble";

export interface Murmur {
  at: number;
  length: number;
  shape: MurmurShape;
  pitch: number;
  q: number;
  level: number;
}

export type ExtraSoundKind = "s3" | "s4" | "snap";

export interface ExtraSound {
  at: number;
  kind: ExtraSoundKind;
}

export interface Planned {
  atria: Contraction[];
  ventricles: Contraction[];
  lub: HeartSound[];
  dub: HeartSound[];
  murmurs: Murmur[];
  extras: ExtraSound[];
}

type Planner = (
  to: number,
  clocks: Record<string, number>,
  random: () => number,
  out: Planned,
) => void;

export interface RhythmDefinition {
  id: RhythmId;
  label: string;
  group: RhythmGroup;
  rate: string;
  what: string;
  quiver: { atria: number; ventricles: number };
  atrialTrace?: AtrialTrace;
  followsBreath?: number;
  plan: Planner;
}

const KINEMATICS = Object.freeze({
  atrialDuration: CYCLE.atria.end - CYCLE.atria.start,
  atrialPeakOffset: CYCLE.atria.peak - CYCLE.atria.start,
  prInterval: CYCLE.ventricles.start - CYCLE.atria.start,
  systoleBaseDuration: CYCLE.ventricles.end - CYCLE.ventricles.start,
  systolePeakRatio: (CYCLE.ventricles.peak - CYCLE.ventricles.start) / (CYCLE.ventricles.end - CYCLE.ventricles.start),
  s2Fraction: (CYCLE.s2 - CYCLE.ventricles.start) / (CYCLE.ventricles.end - CYCLE.ventricles.start),
  rrIntervalNominal: 60 / RESTING_BPM,
});

/** Computes duration of ventricular systole as a function of cycle RR interval. */
export function systoleFor(interval: number): number {
  const scaled = KINEMATICS.systoleBaseDuration * Math.sqrt(interval / KINEMATICS.rrIntervalNominal);
  return Math.min(0.36, Math.max(0.16, scaled));
}

const KinematicBuilder = {
  addAtrium(target: Planned, startTime: number, force = 1): void {
    target.atria.push({
      at: startTime,
      peak: startTime + KINEMATICS.atrialPeakOffset,
      end: startTime + KINEMATICS.atrialDuration,
      strength: force,
    });
  },

  addVentricle(
    target: Planned,
    startTime: number,
    rrSpan: number,
    force = 1,
    s1Amp = 1,
    s2Amp = 1,
    isWide = false,
  ): void {
    const dur = systoleFor(rrSpan);
    target.ventricles.push({
      at: startTime,
      peak: startTime + dur * KINEMATICS.systolePeakRatio,
      end: startTime + dur,
      strength: force,
      wide: isWide,
    });
    if (s1Amp > 0) target.lub.push({ at: startTime, level: s1Amp });
    if (s2Amp > 0) target.dub.push({ at: startTime + dur * KINEMATICS.s2Fraction, level: s2Amp });
  },
};

function createSinusScheduler(bpmVal: number, prDelay: number): Planner {
  const cycleTime = 60 / bpmVal;
  return (untilTime, stateClocks, _rand, accumulator) => {
    stateClocks.atria ??= 0;
    while (stateClocks.atria < untilTime) {
      KinematicBuilder.addAtrium(accumulator, stateClocks.atria);
      KinematicBuilder.addVentricle(accumulator, stateClocks.atria + prDelay, cycleTime);
      stateClocks.atria += cycleTime;
    }
  };
}

interface HarmonicCycleBeat {
  atrium: number;
  s1: number;
  s2: number;
  nextS1: number;
}

function createAuscultationSinusScheduler(
  soundConfig: { s1?: number; s2?: number; strength?: number },
  extraDispatcher: (beatInfo: HarmonicCycleBeat, accumulator: Planned) => void,
): Planner {
  const systoleDuration = systoleFor(KINEMATICS.rrIntervalNominal);
  return (untilTime, stateClocks, _rand, accumulator) => {
    stateClocks.atria ??= 0;
    while (stateClocks.atria < untilTime) {
      const s1Time = stateClocks.atria + KINEMATICS.prInterval;
      KinematicBuilder.addAtrium(accumulator, stateClocks.atria);
      KinematicBuilder.addVentricle(
        accumulator,
        s1Time,
        KINEMATICS.rrIntervalNominal,
        soundConfig.strength ?? 1,
        soundConfig.s1 ?? 1,
        soundConfig.s2 ?? 1,
      );
      extraDispatcher(
        {
          atrium: stateClocks.atria,
          s1: s1Time,
          s2: s1Time + systoleDuration * KINEMATICS.s2Fraction,
          nextS1: s1Time + KINEMATICS.rrIntervalNominal,
        },
        accumulator,
      );
      stateClocks.atria += KINEMATICS.rrIntervalNominal;
    }
  };
}

const STATIC_QUIET = Object.freeze({ atria: 0, ventricles: 0 });

export const RHYTHMS: readonly RhythmDefinition[] = [
  {
    id: "normal",
    label: "Normal sinus rhythm",
    group: "Sinus",
    rate: `${RESTING_BPM} bpm`,
    what:
      "Each beat starts in the atria; after a short pause at the AV node the ventricles " +
      "contract. The first sound is the AV valves closing, the second the aortic and " +
      "pulmonary valves.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createSinusScheduler(RESTING_BPM, KINEMATICS.prInterval),
  },
  {
    id: "sinus_tachycardia",
    label: "Sinus tachycardia",
    group: "Sinus",
    rate: "130 bpm",
    what:
      "The same sequence, faster. Diastole shortens far more than systole, so the " +
      "ventricles have less time to fill between beats.",
    quiver: STATIC_QUIET,
    followsBreath: 0.3,
    plan: createSinusScheduler(130, 0.12),
  },
  {
    id: "sinus_bradycardia",
    label: "Sinus bradycardia",
    group: "Sinus",
    rate: "45 bpm",
    what: "The same sequence, slower, with long pauses in diastole.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createSinusScheduler(45, 0.16),
  },
  {
    id: "av_block_1",
    label: "First-degree AV block",
    group: "Conduction blocks",
    rate: `${RESTING_BPM} bpm`,
    what:
      "Every atrial beat reaches the ventricles, but late: the pause between the atria " +
      "and the ventricles is longer than 0.2 seconds.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createSinusScheduler(RESTING_BPM, 0.32),
  },
  {
    id: "mobitz_1",
    label: "Second-degree AV block, Mobitz I",
    group: "Conduction blocks",
    rate: "Atria 72, ventricles 54 bpm",
    what:
      "Wenckebach: the pause after each atrial beat grows longer, until one atrial beat " +
      "is not followed by the ventricles at all. Then the sequence starts again.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: (untilTime, stateClocks, _rand, accumulator) => {
      const wenckebachDelays = [0.16, 0.24, 0.3];
      stateClocks.atria ??= 0;
      stateClocks.beat ??= 0;
      while (stateClocks.atria < untilTime) {
        KinematicBuilder.addAtrium(accumulator, stateClocks.atria);
        const curDelay = wenckebachDelays[stateClocks.beat % 4];
        if (curDelay !== undefined) {
          KinematicBuilder.addVentricle(accumulator, stateClocks.atria + curDelay, KINEMATICS.rrIntervalNominal);
        }
        stateClocks.atria += KINEMATICS.rrIntervalNominal;
        stateClocks.beat += 1;
      }
    },
  },
  {
    id: "mobitz_2",
    label: "Second-degree AV block, Mobitz II",
    group: "Conduction blocks",
    rate: "Atria 72, ventricles 48 bpm",
    what:
      "The pause stays the same, but some atrial beats are not conducted: the atria " +
      "contract and the ventricles do not, without warning.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: (untilTime, stateClocks, _rand, accumulator) => {
      stateClocks.atria ??= 0;
      stateClocks.beat ??= 0;
      while (stateClocks.atria < untilTime) {
        KinematicBuilder.addAtrium(accumulator, stateClocks.atria);
        if (stateClocks.beat % 3 !== 2) {
          KinematicBuilder.addVentricle(accumulator, stateClocks.atria + 0.16, KINEMATICS.rrIntervalNominal);
        }
        stateClocks.atria += KINEMATICS.rrIntervalNominal;
        stateClocks.beat += 1;
      }
    },
  },
  {
    id: "av_block_3",
    label: "Third-degree (complete) AV block",
    group: "Conduction blocks",
    rate: "Atria 72, ventricles 38 bpm",
    what:
      "Nothing is conducted. The atria keep their own rhythm and the ventricles beat " +
      "slowly on theirs, independently — so the first sound changes in loudness.",
    quiver: STATIC_QUIET,
    plan: (untilTime, stateClocks, randGen, accumulator) => {
      const escapeCycle = 60 / 38;
      stateClocks.atria ??= 0;
      stateClocks.ventricles ??= 0.35;
      while (stateClocks.atria < untilTime) {
        KinematicBuilder.addAtrium(accumulator, stateClocks.atria);
        stateClocks.atria += KINEMATICS.rrIntervalNominal;
      }
      while (stateClocks.ventricles < untilTime) {
        KinematicBuilder.addVentricle(
          accumulator,
          stateClocks.ventricles,
          escapeCycle,
          1,
          0.5 + 0.5 * randGen(),
          1,
          true,
        );
        stateClocks.ventricles += escapeCycle;
      }
    },
  },
  {
    id: "atrial_fibrillation",
    label: "Atrial fibrillation",
    group: "Atrial",
    rate: "About 100 bpm, irregular",
    what:
      "The atria quiver instead of contracting, and the ventricles beat at irregular " +
      "intervals — irregularly irregular. A beat after a short interval has had less time " +
      "to fill, and is weaker and quieter.",
    quiver: { atria: 0.35, ventricles: 0 },
    atrialTrace: "fibrillation",
    plan: (untilTime, stateClocks, randGen, accumulator) => {
      stateClocks.ventricles ??= 0.2;
      stateClocks.filled ??= 0.7;
      while (stateClocks.ventricles < untilTime) {
        const fillFraction = Math.min(1, Math.max(0, (stateClocks.filled - 0.4) / 0.55));
        const amp = 0.55 + 0.45 * fillFraction;
        const randomRR = 0.4 + 0.55 * randGen();
        KinematicBuilder.addVentricle(accumulator, stateClocks.ventricles, randomRR, amp, amp, amp);
        stateClocks.ventricles += randomRR;
        stateClocks.filled = randomRR;
      }
    },
  },
  {
    id: "atrial_flutter",
    label: "Atrial flutter, 2:1",
    group: "Atrial",
    rate: "Atria 300, ventricles 150 bpm",
    what:
      "The atria contract very fast and regularly, about 300 times a minute. The AV node " +
      "lets every second one through, so the ventricles beat about 150.",
    quiver: STATIC_QUIET,
    atrialTrace: "flutter",
    plan: (untilTime, stateClocks, _rand, accumulator) => {
      const flutterPeriod = 0.2;
      stateClocks.atria ??= 0;
      stateClocks.beat ??= 0;
      while (stateClocks.atria < untilTime) {
        KinematicBuilder.addAtrium(accumulator, stateClocks.atria, 0.45);
        if (stateClocks.beat % 2 === 0) {
          KinematicBuilder.addVentricle(
            accumulator,
            stateClocks.atria + 0.16,
            flutterPeriod * 2,
            0.85,
            0.85,
            0.85,
          );
        }
        stateClocks.atria += flutterPeriod;
        stateClocks.beat += 1;
      }
    },
  },
  {
    id: "premature_ventricular",
    label: "Premature ventricular beats",
    group: "Ventricular",
    rate: `${RESTING_BPM} bpm, with early beats`,
    what:
      "Now and then the ventricles contract early, with no atrial beat before them. The " +
      "next atrial beat finds them still recovering and is not conducted, so a pause " +
      "follows before the rhythm goes on.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: (untilTime, stateClocks, _rand, accumulator) => {
      stateClocks.atria ??= 0;
      stateClocks.beat ??= 0;
      while (stateClocks.atria < untilTime) {
        KinematicBuilder.addAtrium(accumulator, stateClocks.atria);
        if (stateClocks.beat % 5 === 3) {
          const priorAtrium = stateClocks.atria - KINEMATICS.rrIntervalNominal;
          const pvcInstant = priorAtrium + KINEMATICS.prInterval + 0.46;
          KinematicBuilder.addVentricle(
            accumulator,
            pvcInstant,
            KINEMATICS.rrIntervalNominal * 0.6,
            0.8,
            0.9,
            0.7,
            true,
          );
        } else {
          KinematicBuilder.addVentricle(
            accumulator,
            stateClocks.atria + KINEMATICS.prInterval,
            KINEMATICS.rrIntervalNominal,
          );
        }
        stateClocks.atria += KINEMATICS.rrIntervalNominal;
        stateClocks.beat += 1;
      }
    },
  },
  {
    id: "ventricular_tachycardia",
    label: "Ventricular tachycardia",
    group: "Ventricular",
    rate: "About 170 bpm",
    what:
      "The ventricles beat very fast on their own, with the atria keeping a separate, " +
      "slower rhythm. With so little time to fill, each beat pumps less.",
    quiver: STATIC_QUIET,
    plan: (untilTime, stateClocks, randGen, accumulator) => {
      const vtCycle = 60 / 170;
      stateClocks.atria ??= 0.1;
      stateClocks.ventricles ??= 0;
      while (stateClocks.atria < untilTime) {
        KinematicBuilder.addAtrium(accumulator, stateClocks.atria);
        stateClocks.atria += KINEMATICS.rrIntervalNominal;
      }
      while (stateClocks.ventricles < untilTime) {
        KinematicBuilder.addVentricle(
          accumulator,
          stateClocks.ventricles,
          vtCycle,
          0.65,
          0.5 + 0.4 * randGen(),
          0.6,
          true,
        );
        stateClocks.ventricles += vtCycle;
      }
    },
  },
  {
    id: "ventricular_fibrillation",
    label: "Ventricular fibrillation",
    group: "Ventricular",
    rate: "No organised beat",
    what:
      "No coordinated contraction: the ventricles quiver and pump nothing, so there are " +
      "no heart sounds and no pulse. This is cardiac arrest.",
    quiver: { atria: 0.25, ventricles: 0.5 },
    atrialTrace: "fibrillation",
    plan: () => {},
  },
  {
    id: "asystole",
    label: "Asystole",
    group: "Ventricular",
    rate: "No beat",
    what:
      "No electrical activity, so nothing contracts and nothing is heard: the flat line " +
      "on an ECG. The heart standing still is the rhythm, not the animation stopping.",
    quiver: STATIC_QUIET,
    plan: () => {},
  },
  {
    id: "aortic_stenosis",
    label: "Aortic stenosis",
    group: "Murmurs and extra sounds",
    rate: `${RESTING_BPM} bpm`,
    what:
      "A narrowed aortic valve: blood forced through it in systole makes a harsh murmur " +
      "that swells and fades between S1 and S2. The second sound is softer, and the pulse " +
      "weaker.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createAuscultationSinusScheduler({ s2: 0.55, strength: 0.8 }, (beat, accumulator) => {
      const onset = beat.s1 + 0.04;
      accumulator.murmurs.push({
        at: onset,
        length: beat.s2 - 0.03 - onset,
        shape: "diamond",
        pitch: 220,
        q: 0.9,
        level: 0.6,
      });
    }),
  },
  {
    id: "mitral_regurgitation",
    label: "Mitral regurgitation",
    group: "Murmurs and extra sounds",
    rate: `${RESTING_BPM} bpm`,
    what:
      "A mitral valve that does not close: some blood leaks back into the left atrium for " +
      "all of systole, heard as an even, blowing murmur from S1 right up to S2. S1 is soft.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createAuscultationSinusScheduler({ s1: 0.55, strength: 0.85 }, (beat, accumulator) => {
      accumulator.murmurs.push({
        at: beat.s1 + 0.01,
        length: beat.s2 - beat.s1,
        shape: "plateau",
        pitch: 380,
        q: 1.2,
        level: 0.45,
      });
    }),
  },
  {
    id: "aortic_regurgitation",
    label: "Aortic regurgitation",
    group: "Murmurs and extra sounds",
    rate: `${RESTING_BPM} bpm`,
    what:
      "An aortic valve that does not close: blood falls back into the left ventricle in " +
      "diastole, heard as a high, blowing murmur that starts at S2 and fades.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createAuscultationSinusScheduler({}, (beat, accumulator) => {
      accumulator.murmurs.push({
        at: beat.s2 + 0.01,
        length: 0.34,
        shape: "decrescendo",
        pitch: 520,
        q: 1.5,
        level: 0.4,
      });
    }),
  },
  {
    id: "mitral_stenosis",
    label: "Mitral stenosis",
    group: "Murmurs and extra sounds",
    rate: `${RESTING_BPM} bpm`,
    what:
      "A narrowed mitral valve: a loud S1, a short opening snap after S2 as the stiff valve " +
      "opens, then a low rumble through diastole that grows as the atria contract.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createAuscultationSinusScheduler({ s1: 1 }, (beat, accumulator) => {
      accumulator.extras.push({ at: beat.s2 + 0.08, kind: "snap" });
      const rumbleOnset = beat.s2 + 0.13;
      accumulator.murmurs.push({
        at: rumbleOnset,
        length: beat.nextS1 - 0.02 - rumbleOnset,
        shape: "rumble",
        pitch: 110,
        q: 1,
        level: 0.65,
      });
    }),
  },
  {
    id: "third_heart_sound",
    label: "Third heart sound (S3)",
    group: "Murmurs and extra sounds",
    rate: `${RESTING_BPM} bpm`,
    what:
      "A low thud just after S2, as blood rushes into a ventricle that is overfilled: " +
      "lub-dub-ta, like the word Kentucky. Normal in children and athletes, a sign of " +
      "heart failure in older adults.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createAuscultationSinusScheduler({}, (beat, accumulator) => {
      accumulator.extras.push({ at: beat.s2 + 0.15, kind: "s3" });
    }),
  },
  {
    id: "fourth_heart_sound",
    label: "Fourth heart sound (S4)",
    group: "Murmurs and extra sounds",
    rate: `${RESTING_BPM} bpm`,
    what:
      "A low thud just before S1, as the atria push blood into a stiff ventricle: " +
      "ta-lub-dub, like the word Tennessee.",
    quiver: STATIC_QUIET,
    followsBreath: 1,
    plan: createAuscultationSinusScheduler({}, (beat, accumulator) => {
      accumulator.extras.push({ at: beat.s1 - 0.07, kind: "s4" });
    }),
  },
];

export function rhythm(id: RhythmId): RhythmDefinition {
  const match = RHYTHMS.find((r) => r.id === id);
  return match ?? RHYTHMS[0]!;
}

function createPrng(initialSeed: number): () => number {
  let s = initialSeed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianPeak(timeInstant: number, centerVal: number, spread: number, amplitude: number): number {
  const norm = (timeInstant - centerVal) / spread;
  if (norm * norm > 16) return 0;
  return amplitude * Math.exp(-norm * norm);
}

function evaluateContractionCurve(currTime: number, c: Contraction): number {
  if (currTime <= c.at || currTime >= c.end) return 0;
  const ascending = c.peak - c.at;
  const descending = c.end - c.peak;
  const rawRatio = currTime < c.peak ? (currTime - c.at) / ascending : 1 - (currTime - c.peak) / descending;
  const clampedRatio = Math.min(1, Math.max(0, rawRatio));
  return c.strength * (clampedRatio * clampedRatio * (3 - 2 * clampedRatio));
}

export interface RhythmFrame {
  atria: number;
  ventricles: number;
  lub: number[];
  dub: number[];
  murmurs: Murmur[];
  extras: ExtraSoundKind[];
}

const RUNTIME_LOOKAHEAD = 2;
const HISTORY_WINDOW = 0.8;

export class RhythmPlayer {
  private readonly planned: Planned = {
    atria: [],
    ventricles: [],
    lub: [],
    dub: [],
    murmurs: [],
    extras: [],
  };
  private readonly clocks: Record<string, number> = {};
  private readonly random: () => number;
  private readonly phases: number[];
  private horizon = 0;

  constructor(
    readonly definition: RhythmDefinition,
    seed = 20260917,
  ) {
    this.random = createPrng(seed);
    this.phases = Array.from({ length: 6 }, () => this.random() * Math.PI * 2);
  }

  advance(before: number, after: number): RhythmFrame {
    if (after + RUNTIME_LOOKAHEAD > this.horizon) {
      this.horizon = after + RUNTIME_LOOKAHEAD;
      this.definition.plan(this.horizon, this.clocks, this.random, this.planned);
      const pruneCutoff = before - HISTORY_WINDOW;
      this.planned.atria = this.planned.atria.filter((c) => c.end >= pruneCutoff);
      this.planned.ventricles = this.planned.ventricles.filter((c) => c.end >= pruneCutoff);
      this.planned.lub = this.planned.lub.filter((s) => s.at >= pruneCutoff);
      this.planned.dub = this.planned.dub.filter((s) => s.at >= pruneCutoff);
      this.planned.murmurs = this.planned.murmurs.filter((m) => m.at >= pruneCutoff);
      this.planned.extras = this.planned.extras.filter((e) => e.at >= pruneCutoff);
    }

    let aValue = this.calculateQuiver(after, this.definition.quiver.atria, 0);
    for (const c of this.planned.atria) {
      aValue = Math.max(aValue, evaluateContractionCurve(after, c));
    }

    let vValue = this.calculateQuiver(after, this.definition.quiver.ventricles, 3);
    for (const c of this.planned.ventricles) {
      vValue = Math.max(vValue, evaluateContractionCurve(after, c));
    }

    const isWithinSpan = (item: { at: number }) => item.at > before && item.at <= after;

    return {
      atria: SQUEEZE.atria * aValue,
      ventricles: SQUEEZE.ventricles * vValue,
      lub: this.planned.lub.filter(isWithinSpan).map((s) => s.level),
      dub: this.planned.dub.filter(isWithinSpan).map((s) => s.level),
      murmurs: this.planned.murmurs.filter(isWithinSpan),
      extras: this.planned.extras.filter(isWithinSpan).map((e) => e.kind),
    };
  }

  ecgAt(t: number): number {
    let voltage = 0;
    const mode = this.definition.atrialTrace ?? "p";

    for (const a of this.planned.atria) {
      if (t < a.at - 0.2 || t > a.end + 0.2) continue;
      if (mode === "p") {
        voltage += gaussianPeak(t, a.at - 0.03, 0.03, 0.14);
      } else if (mode === "flutter") {
        voltage +=
          gaussianPeak(t, a.at + 0.03, 0.05, -0.18) +
          gaussianPeak(t, a.at + 0.13, 0.025, 0.07);
      }
    }

    if (mode === "fibrillation") {
      voltage +=
        0.035 * Math.sin(2 * Math.PI * 6.1 * t + this.phases[0]!) +
        0.02 * Math.sin(2 * Math.PI * 8.7 * t + this.phases[1]!) +
        0.015 * Math.sin(2 * Math.PI * 4.3 * t + this.phases[2]!);
    }

    for (const v of this.planned.ventricles) {
      if (t < v.at - 0.2 || t > v.end + 0.3) continue;
      const span = v.end - v.at;
      const qTime = v.at - 0.04;

      if (v.wide) {
        voltage +=
          gaussianPeak(t, qTime + 0.01, 0.03, 0.85) +
          gaussianPeak(t, qTime + 0.07, 0.03, -0.45) +
          gaussianPeak(t, v.at + 0.62 * span, 0.06, -0.35);
      } else {
        voltage +=
          gaussianPeak(t, qTime - 0.025, 0.008, -0.12) +
          gaussianPeak(t, qTime, 0.011, 1.0) +
          gaussianPeak(t, qTime + 0.022, 0.01, -0.28) +
          gaussianPeak(t, v.at + 0.62 * span, 0.045, 0.28);
      }
    }

    if (this.definition.quiver.ventricles > 0) {
      const envelope = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.4 * t + this.phases[5]!);
      voltage +=
        0.45 * envelope * Math.sin(2 * Math.PI * 5.1 * t + this.phases[3]!) +
        0.18 * Math.sin(2 * Math.PI * 7.3 * t + this.phases[4]!);
    }

    return voltage;
  }

  private calculateQuiver(t: number, magnitude: number, phaseStartIdx: number): number {
    if (magnitude <= 0) return 0;
    const osc =
      0.5 * Math.sin(2 * Math.PI * 5.3 * t + this.phases[phaseStartIdx]!) +
      0.3 * Math.sin(2 * Math.PI * 7.9 * t + this.phases[phaseStartIdx + 1]!) +
      0.2 * Math.sin(2 * Math.PI * 11.7 * t + this.phases[phaseStartIdx + 2]!);
    return magnitude * 0.5 * (1 + osc);
  }
}

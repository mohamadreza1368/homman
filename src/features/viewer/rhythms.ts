/**
 * Hoomaan 3D Viewer - Heart Rhythms, Cardiac Conduction & Murmur Synthesis
 */

import { SQUEEZE } from "./heartbeat";
import type {
  Contraction,
  Planned,
  RhythmDefinition,
  RhythmFrame,
  RhythmId,
} from "./rhythmTypes";
import { RHYTHMS } from "./rhythmsCatalog";

export * from "./rhythmTypes";
export * from "./rhythmsCatalog";

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
  if (currTime < c.peak) {
    const u = (currTime - c.at) / (c.peak - c.at);
    const clampedU = Math.min(1, Math.max(0, u));
    // Physiological rapid ejection acceleration (Guyton & Hall 2026, Ch. 9)
    const factor = Math.pow(Math.sin(clampedU * Math.PI * 0.5), 1.3);
    return c.strength * factor;
  } else {
    const v = (currTime - c.peak) / (c.end - c.peak);
    const clampedV = Math.min(1, Math.max(0, v));
    // Early rapid diastolic relaxation with elastic recoil settling
    const factor = Math.pow(1 - clampedV, 2) * (1 + clampedV * 1.5);
    return c.strength * factor;
  }
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

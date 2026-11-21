import type { HeartRhythmId } from "@/lib/schemas";

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

export type Planner = (
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

export interface RhythmFrame {
  atria: number;
  ventricles: number;
  lub: number[];
  dub: number[];
  murmurs: Murmur[];
  extras: ExtraSoundKind[];
}

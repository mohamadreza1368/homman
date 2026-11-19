/**
 * Hoomaan 3D Viewer - Synthesized Cardiac Sounds & Murmurs Audio Engine
 */

import type { ExtraSoundKind, Murmur, MurmurShape } from "./rhythms";

type AudioCtxCtor = typeof AudioContext;

let audioCtx: AudioContext | null = null;
let masterOutputNode: AudioNode | null = null;

interface CardiacThump {
  from: number;
  to: number;
  seconds: number;
  gain: number;
  knock: number;
}

export const LUB: CardiacThump = { from: 58, to: 40, seconds: 0.22, gain: 0.95, knock: 0.35 };
export const DUB: CardiacThump = { from: 76, to: 54, seconds: 0.15, gain: 0.85, knock: 0.4 };

const PARTIALS: readonly [number, number][] = [
  [1, 1],
  [2, 0.75],
  [3, 0.25],
];

const KNOCK_CONFIG = { seconds: 0.06, centre: 120, q: 0.8, attack: 0.008 };
const MURMUR_GAIN = 2.2;

/** Initializes Web Audio context and sound compression pipeline on user gesture. */
export function primeHeartSound(): void {
  try {
    const Ctx: AudioCtxCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext;
    if (!Ctx) return;

    if (!audioCtx) {
      audioCtx = new Ctx();

      const bodyFilter = audioCtx.createBiquadFilter();
      bodyFilter.type = "peaking";
      bodyFilter.frequency.value = 110;
      bodyFilter.Q.value = 0.9;
      bodyFilter.gain.value = 6;

      const lowPassFilter = audioCtx.createBiquadFilter();
      lowPassFilter.type = "lowpass";
      lowPassFilter.frequency.value = 600;

      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.15;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.8;

      bodyFilter
        .connect(lowPassFilter)
        .connect(comp)
        .connect(gainNode)
        .connect(audioCtx.destination);
      masterOutputNode = bodyFilter;
    }

    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
  } catch {
    // audio optional
  }
}

function playThump(thump: CardiacThump, volumeLevel: number): void {
  const ctx = audioCtx;
  const out = masterOutputNode;
  const factor = Math.min(1, volumeLevel);
  if (!ctx || !out || ctx.state !== "running" || !(factor > 0)) return;

  try {
    const startTime = ctx.currentTime;
    const endTime = startTime + thump.seconds;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.exponentialRampToValueAtTime(thump.gain * factor, startTime + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, endTime);
    env.connect(out);

    for (const [harmonic, ratio] of PARTIALS) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(thump.from * harmonic, startTime);
      osc.frequency.exponentialRampToValueAtTime(thump.to * harmonic, endTime);

      const partialMix = ctx.createGain();
      partialMix.gain.value = ratio;
      osc.connect(partialMix).connect(env);
      osc.start(startTime);
      osc.stop(endTime + 0.02);
    }

    const sampleCount = Math.ceil(ctx.sampleRate * KNOCK_CONFIG.seconds);
    const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) channelData[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const bandFilter = ctx.createBiquadFilter();
    bandFilter.type = "bandpass";
    bandFilter.frequency.value = KNOCK_CONFIG.centre;
    bandFilter.Q.value = KNOCK_CONFIG.q;

    const knockEnv = ctx.createGain();
    knockEnv.gain.setValueAtTime(0.0001, startTime);
    knockEnv.gain.exponentialRampToValueAtTime(thump.knock * factor, startTime + KNOCK_CONFIG.attack);
    knockEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + KNOCK_CONFIG.seconds);

    noiseSrc.connect(bandFilter).connect(knockEnv).connect(out);
    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + KNOCK_CONFIG.seconds + 0.01);
  } catch {
    // gracefully ignore audio failure
  }
}

/** Plays primary S1 (lub) valve closure sound. */
export function playLub(level = 1): void {
  playThump(LUB, level);
}

/** Plays secondary S2 (dub) semilunar valve closure sound. */
export function playDub(level = 1): void {
  playThump(DUB, level);
}

export const EXTRA: Readonly<Record<ExtraSoundKind, CardiacThump>> = {
  s3: { from: 46, to: 36, seconds: 0.11, gain: 0.75, knock: 0.12 },
  s4: { from: 50, to: 40, seconds: 0.09, gain: 0.65, knock: 0.1 },
  snap: { from: 140, to: 110, seconds: 0.05, gain: 0.55, knock: 0.6 },
};

/** Plays extra gallop or snap sound (S3, S4, snap). */
export function playExtra(kind: ExtraSoundKind): void {
  playThump(EXTRA[kind], 1);
}

/** Calculates audio envelope curve array for given murmur shape. */
export function murmurEnvelope(shape: MurmurShape, points = 32): Float32Array {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    const edge = Math.min(1, x / 0.08, (1 - x) / 0.08);
    let level: number;
    if (shape === "diamond") level = 1 - Math.abs(2 * x - 1);
    else if (shape === "plateau") level = 1;
    else if (shape === "decrescendo") level = Math.pow(1 - x, 1.6);
    else level = 0.55 + 0.45 * Math.pow(x, 3);
    curve[i] = Math.max(0.0001, level * Math.max(0, edge));
  }
  return curve;
}

/** Plays filtered turbulent noise cardiac murmur. */
export function playMurmur(murmur: Murmur): void {
  const ctx = audioCtx;
  const out = masterOutputNode;
  if (!ctx || !out || ctx.state !== "running" || !(murmur.length > 0) || !(murmur.level > 0)) return;

  try {
    const startTime = ctx.currentTime;
    const sampleCount = Math.ceil(ctx.sampleRate * murmur.length);
    const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) channelData[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const bandFilter = ctx.createBiquadFilter();
    bandFilter.type = "bandpass";
    bandFilter.frequency.value = murmur.pitch;
    bandFilter.Q.value = murmur.q;

    const env = ctx.createGain();
    env.gain.value = 0.0001;
    const curve = murmurEnvelope(murmur.shape).map((val) => val * murmur.level * MURMUR_GAIN);
    env.gain.setValueCurveAtTime(curve, startTime, murmur.length);

    noiseSrc.connect(bandFilter).connect(env).connect(out);
    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + murmur.length + 0.01);
  } catch {
    // gracefully ignore audio failure
  }
}

/** Clears audio context reference for test isolation. */
export function forgetHeartSound(): void {
  audioCtx = null;
  masterOutputNode = null;
}

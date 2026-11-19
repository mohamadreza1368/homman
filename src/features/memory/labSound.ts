import type { MemoryKind } from "./memories";
import type { LabPhase } from "./scene/memoryScene";

export const hz = (midiKey: number): number => 440 * 2 ** ((midiKey - 69) / 12);

const PENTATONIC_STEPS = [0, 3, 5, 7, 10] as const;

export function scaleNote(stepIndex: number, referencePitch = 69): number {
  const octaveCount = Math.floor(stepIndex / PENTATONIC_STEPS.length);
  const intervalIndex =
    ((stepIndex % PENTATONIC_STEPS.length) + PENTATONIC_STEPS.length) % PENTATONIC_STEPS.length;
  return referencePitch + octaveCount * 12 + PENTATONIC_STEPS[intervalIndex]!;
}

const TOTAL_MAPPING_STEPS = 12;

export function mappingNote(currentIndex: number, totalCount: number): number {
  const ratio = totalCount <= 1 ? 0 : currentIndex / (totalCount - 1);
  return scaleNote(Math.round(ratio * TOTAL_MAPPING_STEPS));
}

export const PROGRESSION: readonly (readonly number[])[] = [
  [45, 52, 60, 71], // Am9
  [41, 48, 57, 64], // Fmaj9
  [48, 55, 64, 71], // Cmaj9
  [40, 47, 55, 66], // Em9
];

export const KIND_CHORD: Record<MemoryKind, readonly number[]> = {
  session: PROGRESSION[2]!,
  case: PROGRESSION[1]!,
  note: PROGRESSION[3]!,
};

const MASTER_GAIN = 0.55;
const STORAGE_SOUND_KEY = "hoomaan.memory.sound.v1";

export function storedLabSound(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function storeLabSound(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_SOUND_KEY, enabled ? "on" : "off");
  } catch {
    // Ignore storage restriction issues in restricted/private contexts
  }
}

export interface LabSound {
  setEnabled(on: boolean): void;
  resume(): void;
  phase(phase: LabPhase): void;
  mapped(i: number, count: number): void;
  hover(kind: MemoryKind): void;
  select(kind: MemoryKind | null): void;
  holdStart(): void;
  holdEnd(): void;
  erase(): void;
  restore(): void;
  close(): void;
}

const NOOP_SOUND: LabSound = {
  setEnabled() {},
  resume() {},
  phase() {},
  mapped() {},
  hover() {},
  select() {},
  holdStart() {},
  holdEnd() {},
  erase() {},
  restore() {},
  close() {},
};

type AudioCtor = typeof AudioContext;

export function createLabSound(initialEnabled: boolean): LabSound {
  let audioContext: AudioContext;
  try {
    const AudioContextClass: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!AudioContextClass) {
      return NOOP_SOUND;
    }
    audioContext = new AudioContextClass();
  } catch {
    return NOOP_SOUND;
  }

  try {
    return assembleSynthesizer(audioContext, initialEnabled);
  } catch {
    void audioContext.close().catch(() => undefined);
    return NOOP_SOUND;
  }
}

function assembleSynthesizer(ctx: AudioContext, enabled: boolean): LabSound {
  const masterNode = ctx.createGain();
  masterNode.gain.value = enabled ? MASTER_GAIN : 0;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 6;
  masterNode.connect(compressor).connect(ctx.destination);

  // Synthesized acoustic spatial impulse
  const convolver = ctx.createConvolver();
  convolver.buffer = generateImpulse(ctx, 3.4);
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.5;
  convolver.connect(wetGain).connect(masterNode);

  // Digital tape delay loop
  const delayNode = ctx.createDelay(1);
  delayNode.delayTime.value = 0.31;
  const feedbackNode = ctx.createGain();
  feedbackNode.gain.value = 0.32;
  const delaySend = ctx.createGain();
  delaySend.gain.value = 0.4;

  delayNode.connect(feedbackNode).connect(delayNode);
  delayNode.connect(delaySend);
  delaySend.connect(masterNode);
  delaySend.connect(convolver);

  const voiceBus = ctx.createGain();
  voiceBus.connect(masterNode);
  voiceBus.connect(delayNode);
  voiceBus.connect(convolver);

  const triggerChime = (midiNote: number, startTime: number, amplitude: number, decayTime = 1.2) => {
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(amplitude, startTime + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime);
    envelope.connect(voiceBus);

    const harmonics: readonly [number, number][] = [
      [1.0, 1.0],
      [2.01, 0.25],
      [3.98, 0.06],
    ];

    for (const [ratio, weighting] of harmonics) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz(midiNote) * ratio;
      const subGain = ctx.createGain();
      subGain.gain.value = weighting;
      osc.connect(subGain).connect(envelope);
      osc.start(startTime);
      osc.stop(startTime + decayTime + 0.05);
    }
  };

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const channelData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < channelData.length; i++) {
    channelData[i] = Math.random() * 2 - 1;
  }

  const triggerSweep = (startFreq: number, endFreq: number, duration: number, peakLevel: number) => {
    const t0 = ctx.currentTime;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(startFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);

    const sweepGain = ctx.createGain();
    sweepGain.gain.setValueAtTime(0.0001, t0);
    sweepGain.gain.exponentialRampToValueAtTime(peakLevel, t0 + duration * 0.35);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    noiseSource.connect(filter).connect(sweepGain);
    sweepGain.connect(masterNode);
    sweepGain.connect(convolver);

    noiseSource.start(t0);
    noiseSource.stop(t0 + duration + 0.05);
  };

  let previousBlipTime = 0;
  let previousHoverTime = 0;
  let activeCharge: { osc: OscillatorNode; gain: GainNode } | null = null;
  let isClosed = false;

  const safeCall =
    <TArgs extends unknown[]>(callback: (...args: TArgs) => void) =>
    (...args: TArgs) => {
      if (isClosed) return;
      try {
        callback(...args);
      } catch {
        // Suppress audio rendering glitches
      }
    };

  return {
    setEnabled: safeCall((active: boolean) => {
      masterNode.gain.setTargetAtTime(active ? MASTER_GAIN : 0, ctx.currentTime, 0.15);
      if (active) void ctx.resume();
    }),
    resume: safeCall(() => {
      if (ctx.state === "suspended") void ctx.resume();
    }),
    phase: safeCall((stage: LabPhase) => {
      const now = ctx.currentTime;
      if (stage === "boot") {
        triggerChime(45, now, 0.03, 2.2);
      } else if (stage === "deploy") {
        triggerSweep(180, 2600, 2.4, 0.05);
      } else if (stage === "materialize") {
        PROGRESSION[0]!.forEach((midi, idx) => {
          triggerChime(midi + 24, now + idx * 0.09, 0.035, 2.4);
        });
      }
    }),
    mapped: safeCall((idx: number, count: number) => {
      const now = ctx.currentTime;
      if (now - previousBlipTime < 0.085) return;
      previousBlipTime = now;
      triggerChime(mappingNote(idx, count), now, 0.03, 0.5);
    }),
    hover: safeCall((kind: MemoryKind) => {
      const now = ctx.currentTime;
      if (now - previousHoverTime < 0.09) return;
      previousHoverTime = now;
      const leadNote = KIND_CHORD[kind][3]!;
      triggerChime(leadNote + 12, now, 0.012, 0.25);
    }),
    select: safeCall((kind: MemoryKind | null) => {
      if (!kind) return;
      const now = ctx.currentTime;
      KIND_CHORD[kind].slice(1).forEach((midi, i) => {
        triggerChime(midi + 12, now + i * 0.07, 0.03, 1.6);
      });
    }),
    holdStart: safeCall(() => {
      if (activeCharge) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(hz(57), now);
      osc.frequency.exponentialRampToValueAtTime(hz(81), now + 1.4);

      const chargeGain = ctx.createGain();
      chargeGain.gain.setValueAtTime(0.0001, now);
      chargeGain.gain.exponentialRampToValueAtTime(0.02, now + 1.2);

      osc.connect(chargeGain).connect(voiceBus);
      osc.start(now);
      activeCharge = { osc, gain: chargeGain };
    }),
    holdEnd: safeCall(() => {
      if (!activeCharge) return;
      const now = ctx.currentTime;
      activeCharge.gain.gain.cancelScheduledValues(now);
      activeCharge.gain.gain.setTargetAtTime(0.0001, now, 0.04);
      activeCharge.osc.stop(now + 0.3);
      activeCharge = null;
    }),
    erase: safeCall(() => {
      const now = ctx.currentTime;
      triggerSweep(2400, 160, 1.5, 0.06);
      [33, 40].forEach((midi) => triggerChime(midi + 12, now, 0.04, 2.6));
    }),
    restore: safeCall(() => {
      const now = ctx.currentTime;
      [0, 2, 4, 5].forEach((step, idx) => {
        triggerChime(scaleNote(step), now + idx * 0.08, 0.03, 1.2);
      });
      triggerSweep(300, 2200, 0.9, 0.025);
    }),
    close: safeCall(() => {
      isClosed = true;
      const now = ctx.currentTime;
      masterNode.gain.cancelScheduledValues(now);
      masterNode.gain.setTargetAtTime(0, now, 0.12);
      window.setTimeout(() => void ctx.close().catch(() => undefined), 700);
    }),
  };
}

function generateImpulse(ctx: AudioContext, lengthSeconds: number): AudioBuffer {
  const sampleLength = Math.floor(ctx.sampleRate * lengthSeconds);
  const impulseBuffer = ctx.createBuffer(2, sampleLength, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const pcm = impulseBuffer.getChannelData(ch);
    for (let s = 0; s < sampleLength; s++) {
      const envelope = (1 - s / sampleLength) ** 3;
      pcm[s] = (Math.random() * 2 - 1) * envelope;
    }
  }
  return impulseBuffer;
}

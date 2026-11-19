/**
 * Hoomaan 3D Viewer - Scanner Laser Plane Acoustic Ping Synthesizer
 */

type AudioCtxCtor = typeof AudioContext;

let scanAudioContext: AudioContext | null = null;

const PING_CONFIG = {
  from: 920,
  to: 560,
  seconds: 0.4,
  gain: 0.06,
};

/** Primes and resumes audio context on user gesture for scanner audio feedback. */
export function primeScanSound(): void {
  try {
    const Ctx: AudioCtxCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext;
    if (!Ctx) return;
    scanAudioContext ??= new Ctx();
    if (scanAudioContext.state === "suspended") {
      void scanAudioContext.resume();
    }
  } catch {
    // audio optional
  }
}

/** Plays gentle instrument ping when slider drag is released. */
export function playScanPing(): void {
  const ctx = scanAudioContext;
  if (!ctx || ctx.state !== "running") return;

  try {
    const startTime = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(PING_CONFIG.from, startTime);
    osc.frequency.exponentialRampToValueAtTime(PING_CONFIG.to, startTime + PING_CONFIG.seconds);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(PING_CONFIG.gain, startTime + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + PING_CONFIG.seconds);

    osc.connect(gainNode).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + PING_CONFIG.seconds + 0.02);
  } catch {
    // gracefully ignore audio failure
  }
}

/** Resets audio context reference for test isolation. */
export function forgetScanSound(): void {
  scanAudioContext = null;
}

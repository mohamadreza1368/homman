/**
 * Adaptive rendering quality management for MemoryLab 3D viewport.
 *
 * Dynamically scales pixel density, bloom pass downsampling and particle density
 * based on GPU device profiling and moving median frame latencies.
 */

export interface Level {
  scale: number;
  bloom: number;
  particles: number;
}

export const LEVELS: readonly Level[] = [
  { scale: 0.8, bloom: 0.3, particles: 0.3 },
  { scale: 0.85, bloom: 0.45, particles: 0.55 },
  { scale: 0.92, bloom: 0.7, particles: 0.8 },
  { scale: 1, bloom: 1, particles: 1 },
];

export const FULL = LEVELS.length - 1;

export function pixelRatioFor(profile: Level, dpr: number): number {
  const effectiveDpr = dpr || 1;
  const scaled = effectiveDpr * profile.scale;
  return Math.min(1.75, Math.max(0.5, scaled));
}

export type Adapter = "software" | "integrated" | "dedicated" | "unknown";

/**
 * Categorizes graphics hardware category by inspecting WebGL renderer description.
 */
export function classifyAdapter(rendererDesc: string | null): Adapter {
  if (!rendererDesc) {
    return "unknown";
  }

  const desc = rendererDesc.toLowerCase();

  if (/swiftshader|basic render|llvmpipe|softpipe|software|warp/.test(desc)) {
    return "software";
  }

  if (
    /nvidia|geforce|quadro|rtx|gtx|radeon\s*(rx|pro)|arc\s*a\d|\bamd\b.*\brx\b/.test(
      desc,
    )
  ) {
    return "dedicated";
  }

  if (
    /intel|uhd|iris|hd graphics|radeon\(tm\) graphics|radeon graphics|vega|adreno|mali|apple/.test(
      desc,
    )
  ) {
    return "integrated";
  }

  return "unknown";
}

/**
 * Selects safe initial graphics preset according to detected GPU classification.
 */
export function startingLevel(adapterType: Adapter): number {
  switch (adapterType) {
    case "software":
      return 0;
    case "integrated":
      return FULL - 1;
    case "dedicated":
    case "unknown":
    default:
      return FULL;
  }
}

const SAMPLE_WINDOW_SIZE = 120;
const DISCARD_OUTLIER_MS = 250;
const DOWNGRADE_THRESHOLD_MS = 25;
const UPGRADE_STABILITY_COUNT = 10;
const SMOOTH_FRAME_MAX_MS = 18;

/**
 * Monitors frame rendering times to scale visual fidelity up or down smoothly.
 */
export class FrameGovernor {
  private buffer: number[] = [];
  private consecutiveSteadyWindows = 0;
  level: number;

  constructor(
    private readonly maxAllowedLevel: number,
    initialTier = maxAllowedLevel,
  ) {
    this.level = Math.min(initialTier, maxAllowedLevel);
  }

  sample(frameDurationMs: number): number | null {
    if (!(frameDurationMs > 0) || frameDurationMs > DISCARD_OUTLIER_MS) {
      return null;
    }

    this.buffer.push(frameDurationMs);
    if (this.buffer.length < SAMPLE_WINDOW_SIZE) {
      return null;
    }

    const sortedDurations = [...this.buffer].sort((d1, d2) => d1 - d2);
    const medianDuration = sortedDurations[sortedDurations.length >> 1]!;
    this.buffer = [];

    // Downgrade quality if latency violates threshold
    if (medianDuration > DOWNGRADE_THRESHOLD_MS && this.level > 0) {
      this.consecutiveSteadyWindows = 0;
      this.level -= 1;
      return this.level;
    }

    // Upgrade quality if consistently operating below smooth threshold
    if (medianDuration <= SMOOTH_FRAME_MAX_MS) {
      this.consecutiveSteadyWindows += 1;
    } else {
      this.consecutiveSteadyWindows = 0;
    }

    if (
      this.consecutiveSteadyWindows >= UPGRADE_STABILITY_COUNT &&
      this.level < this.maxAllowedLevel
    ) {
      this.consecutiveSteadyWindows = 0;
      this.level += 1;
      return this.level;
    }

    return null;
  }
}

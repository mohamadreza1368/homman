import { BREATH_PATTERNS, type BreathPatternId } from "@/features/viewer/breathing";
import { rhythm, type RhythmId } from "@/features/viewer/rhythms";
import { breathNote } from "@/features/viewer/sinusArrhythmia";
import type { BreathContext, SessionMode } from "@/lib/schemas";

export interface BreathAimInput {
  enabled: boolean;
  mode: SessionMode;
  pattern: BreathPatternId;
  heartEnabled: boolean;
  rhythm: RhythmId;
}

/**
 * Constructs contextual respiratory data for inclusion in tutor prompts.
 * Describes current ventilatory mechanics and physiological modulation of heart rate.
 */
export function breathAim(input: BreathAimInput): BreathContext | null {
  if (!input.enabled || input.mode !== "tutor") {
    return null;
  }

  const activePattern = BREATH_PATTERNS[input.pattern];
  const cardiacModulation = input.heartEnabled
    ? breathNote(rhythm(input.rhythm).followsBreath ?? 0)
    : null;

  return {
    pattern: activePattern.label,
    rate: activePattern.rate,
    what: activePattern.what,
    heart: cardiacModulation,
  };
}

import { rhythm, type RhythmId } from "@/features/viewer/rhythms";
import type { HeartContext, SessionMode } from "@/lib/schemas";

export interface HeartAimInput {
  enabled: boolean;
  mode: SessionMode;
  rhythm: RhythmId;
  sound: boolean;
}

/**
 * Builds cardiac rhythm context for conversational tutoring sessions.
 * Communicates the active dysrhythmia or normal sinus rhythm, ventricular rate,
 * physiological description, and phonocardiogram/auscultation state.
 */
export function heartAim(input: HeartAimInput): HeartContext | null {
  if (!input.enabled || input.mode !== "tutor") {
    return null;
  }

  const selectedRhythm = rhythm(input.rhythm);

  return {
    rhythm: selectedRhythm.label,
    rate: selectedRhythm.rate,
    pattern: selectedRhythm.what,
    sound: input.sound,
  };
}

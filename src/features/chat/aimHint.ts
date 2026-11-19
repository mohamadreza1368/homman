import { useCallback, useState } from "react";

import { readLocal, writeLocal } from "@/lib/localStore";
import type { SessionMode } from "@/lib/schemas";

const AIM_HINT_PERSISTENCE_KEY = "hoomaan.aimHint.v1";

function retrieveLearnedFlag(): boolean {
  try {
    return readLocal(AIM_HINT_PERSISTENCE_KEY) === "learned";
  } catch {
    return false;
  }
}

export interface AimHintInput {
  drafting: boolean;
  hasAim: boolean;
  mode: SessionMode;
  learned: boolean;
}

/**
 * Determines whether the user should be prompted to select an anatomical structure
 * before submitting a general question, preventing broad ungrounded LLM completions.
 */
export function shouldShowAimHint({ drafting, hasAim, mode, learned }: AimHintInput): boolean {
  if (learned || hasAim || !drafting) {
    return false;
  }
  return mode !== "case";
}

export function useAimHint() {
  const [learned, setLearned] = useState<boolean>(retrieveLearnedFlag);

  const retire = useCallback(() => {
    setLearned(true);
    try {
      writeLocal(AIM_HINT_PERSISTENCE_KEY, "learned");
    } catch {
      // Ignore localStorage write failures silently
    }
  }, []);

  return { learned, retire };
}

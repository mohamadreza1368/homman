import { useEffect, useRef, useState } from "react";

/** Minimum duration to display opening splash screen and prevent perceptible flicker. */
export const MINIMUM_MS = 900;

/** Maximum timeout ceiling ensuring the user is not permanently blocked if assets fail to load. */
export const CEILING_MS = 12_000;

/** Duration of the exit fade animation in milliseconds. */
export const FADE_MS = 420;

export type SplashPhase = "showing" | "leaving" | "gone";

/**
 * Manages presentation lifecycle and smooth exit transitions for the application launch splash screen.
 */
export function useSplash(ready: boolean): { visible: boolean; leaving: boolean } {
  const [currentPhase, setCurrentPhase] = useState<SplashPhase>("showing");
  const splashStartTime = useRef(Date.now());

  useEffect(() => {
    if (currentPhase !== "showing") return;

    const elapsedTime = Date.now() - splashStartTime.current;
    const remainingMinimum = Math.max(MINIMUM_MS - elapsedTime, 0);
    const targetDelay = ready ? remainingMinimum : CEILING_MS - elapsedTime;

    const dismissTimer = setTimeout(
      () => setCurrentPhase("leaving"),
      Math.max(targetDelay, 0),
    );

    return () => clearTimeout(dismissTimer);
  }, [ready, currentPhase]);

  useEffect(() => {
    if (currentPhase !== "leaving") return;

    const finishFadeTimer = setTimeout(() => setCurrentPhase("gone"), FADE_MS);
    return () => clearTimeout(finishFadeTimer);
  }, [currentPhase]);

  return {
    visible: currentPhase !== "gone",
    leaving: currentPhase === "leaving",
  };
}

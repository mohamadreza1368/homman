import { useCallback, useEffect, useRef, useState } from "react";

import type { Language } from "@/lib/schemas";
import { chatPreferences } from "@/stores/chatPreferences";
import { speakableText, speechChunks } from "./speakableText";
import { effectiveLanguage, voicesForLanguage } from "./speech";
import { useLocalVoices } from "./useLocalVoices";

export type SpeechState = "idle" | "speaking";

export interface UseSpokenAnswer {
  state: SpeechState;
  supports: (language: Language) => boolean;
  error: string | null;
  speak: (markdown: string, language: Language) => void;
  stop: () => void;
}

function getSystemSynthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

/**
 * Hook for playing audio narration of generated clinical/educational responses
 * using local on-device SpeechSynthesis voices.
 */
export function useSpokenAnswer(): UseSpokenAnswer {
  const [playbackState, setPlaybackState] = useState<SpeechState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const availableVoices = useLocalVoices();

  const isIntentionallyStopping = useRef(false);

  useEffect(() => {
    const synth = getSystemSynthesis();
    if (!synth) return;

    return () => {
      synth.cancel();
    };
  }, []);

  const supports = useCallback(
    (lang: Language) => voicesForLanguage(availableVoices, lang).length > 0,
    [availableVoices],
  );

  const stop = useCallback(() => {
    const synth = getSystemSynthesis();
    if (!synth) return;
    isIntentionallyStopping.current = true;
    synth.cancel();
    setPlaybackState("idle");
  }, []);

  const speak = useCallback(
    (markdown: string, lang: Language) => {
      const synth = getSystemSynthesis();
      if (!synth) {
        setLastError("This build of the app has no speech support.");
        return;
      }

      const resolvedLang = effectiveLanguage(lang, markdown);
      const chosenVoice = resolvedLang
        ? voicesForLanguage(availableVoices, resolvedLang)[0]
        : undefined;

      if (!chosenVoice) {
        setLastError("No voice for this language is installed on this computer.");
        return;
      }

      const prefs = chatPreferences();
      const narrationText = speakableText(markdown, prefs.spokenLimit);
      const segments = speechChunks(narrationText);
      if (segments.length === 0) return;

      setLastError(null);
      isIntentionallyStopping.current = true;
      synth.cancel();

      // Defer queuing until next tick so Chromium clears previous queue cleanly
      setTimeout(() => {
        isIntentionallyStopping.current = false;
        setPlaybackState("speaking");

        segments.forEach((segment, idx) => {
          const utterance = new SpeechSynthesisUtterance(segment);
          utterance.voice = chosenVoice;
          utterance.lang = chosenVoice.lang;
          utterance.rate = prefs.spokenSpeed;
          utterance.volume = prefs.spokenVolume;

          if (idx === segments.length - 1) {
            utterance.onend = () => setPlaybackState("idle");
          }

          utterance.onerror = (evt) => {
            if (
              isIntentionallyStopping.current ||
              evt.error === "canceled" ||
              evt.error === "interrupted"
            ) {
              return;
            }
            setLastError("The voice stopped unexpectedly.");
            setPlaybackState("idle");
          };

          synth.speak(utterance);
        });
      }, 0);
    },
    [availableVoices],
  );

  return {
    state: playbackState,
    supports,
    error: lastError,
    speak,
    stop,
  };
}

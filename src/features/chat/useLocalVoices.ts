import { useEffect, useState } from "react";
import { loadVoices } from "./speech";

/**
 * React hook that asynchronously retrieves host-native speech synthesis voices
 * once enumerated by the platform.
 */
export function useLocalVoices(): readonly SpeechSynthesisVoice[] {
  const [voiceList, setVoiceList] = useState<readonly SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synthesizer = window.speechSynthesis;
    if (!synthesizer) return;

    let isSubscribed = true;

    void loadVoices(synthesizer).then((discoveredVoices) => {
      if (isSubscribed) {
        setVoiceList(discoveredVoices);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, []);

  return voiceList;
}

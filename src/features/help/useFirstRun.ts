import { useCallback, useState } from "react";
import { readLocal, writeLocal } from "@/lib/localStore";

const FIRST_RUN_GUIDE_STORAGE_KEY = "hoomaan.guide.v1";

function checkHasSeenGuide(): boolean {
  try {
    return readLocal(FIRST_RUN_GUIDE_STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

/**
 * Tracks initial application launch status synchronously to show the tutorial
 * guide overlay without UI layout flashing or async round-trip latency.
 */
export function useFirstRun() {
  const [acknowledged, setAcknowledged] = useState(checkHasSeenGuide);

  const markSeen = useCallback(() => {
    setAcknowledged(true);
    try {
      writeLocal(FIRST_RUN_GUIDE_STORAGE_KEY, "seen");
    } catch {
      // Gracefully disregard storage quotas
    }
  }, []);

  return {
    firstRun: !acknowledged,
    markSeen,
  };
}

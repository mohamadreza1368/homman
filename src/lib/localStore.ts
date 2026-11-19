import { logEvent } from "./appLog";

type StorageListener = () => void;

let activeFailure: string | null = null;
const listeners = new Set<StorageListener>();

/**
 * Returns the initial storage failure description encountered during this session,
 * or null if localStorage operations remain healthy.
 */
export function storageFailure(): string | null {
  return activeFailure;
}

/**
 * Subscribes to storage failure events. Returns an unsubscribe function.
 */
export function onStorageFailure(listener: StorageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function recordFailure(error: unknown): void {
  if (activeFailure !== null) return;
  activeFailure =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error("[storage] localStorage failure encountered:", error);
  logEvent("error", "storage", activeFailure);
  for (const listener of listeners) {
    try {
      listener();
    } catch (listenerError) {
      console.error("[storage] listener threw:", listenerError);
    }
  }
}

/**
 * Reads a string value from localStorage by key.
 * Transparently migrates any legacy prefixes and gracefully captures failures.
 */
export function readLocal(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;

    if (key.startsWith("hoomaan.")) {
      const legacyKey = key.replace(/^hoomaan\./, "anatria3d.");
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue !== null) {
        try {
          localStorage.setItem(key, legacyValue);
          localStorage.removeItem(legacyKey);
        } catch {
          // Non-blocking migration failure
        }
        return legacyValue;
      }
    }
    return null;
  } catch (error) {
    recordFailure(error);
    return null;
  }
}

/**
 * Writes a string value into localStorage. Returns true on success, false on error.
 */
export function writeLocal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    recordFailure(error);
    return false;
  }
}

/**
 * Removes a key from localStorage. Failures are captured silently.
 */
export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    recordFailure(error);
  }
}

const STORAGE_STAMP_KEY = "hoomaan.storage.stamp";
const PROBE_TEST_KEY = "hoomaan.storage.probe";

/**
 * Verifies that the client runtime permits write/remove storage cycles.
 */
export function checkStorage(): void {
  if (!writeLocal(PROBE_TEST_KEY, "1")) return;
  removeLocal(PROBE_TEST_KEY);
}

function hasStoredPreferences(): boolean {
  try {
    const len = localStorage.length;
    for (let i = 0; i < len; i += 1) {
      const k = localStorage.key(i);
      if (
        k !== null &&
        k !== STORAGE_STAMP_KEY &&
        (k.startsWith("hoomaan.") || k.startsWith("anatria3d."))
      ) {
        return true;
      }
    }
    return false;
  } catch (error) {
    recordFailure(error);
    return false;
  }
}

/**
 * Confirms whether localStorage persists data across application sessions.
 * Alerts only when existing journal history confirms prior usage but no settings survived.
 */
export function confirmStoragePersists(hasHistory: boolean): void {
  const existingStamp = readLocal(STORAGE_STAMP_KEY);
  if (existingStamp === null && hasHistory && !hasStoredPreferences()) {
    recordFailure(
      new Error(
        "Previous settings were not retained — web storage appears ephemeral or memory-only.",
      ),
    );
  }
  writeLocal(STORAGE_STAMP_KEY, String(Date.now()));
}

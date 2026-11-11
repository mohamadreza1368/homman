export const DISCLAIMER_VERSION = '1.0.0';
export const DISCLAIMER_STORAGE_KEY = 'homman_educational_disclaimer_v1';

export interface DisclaimerAcceptanceRecord {
  accepted: boolean;
  version: string;
  acceptedAt: string;
}

export function loadDisclaimerAcceptance(storage?: Storage | null): DisclaimerAcceptanceRecord | null {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return null;
    const raw = store.getItem(DISCLAIMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DisclaimerAcceptanceRecord>;
    if (parsed && parsed.accepted === true && parsed.version === DISCLAIMER_VERSION) {
      return {
        accepted: true,
        version: parsed.version,
        acceptedAt: parsed.acceptedAt || new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDisclaimerAcceptance(storage?: Storage | null): DisclaimerAcceptanceRecord {
  const record: DisclaimerAcceptanceRecord = {
    accepted: true,
    version: DISCLAIMER_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    store?.setItem(DISCLAIMER_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode / restricted storage fallback
  }
  return record;
}

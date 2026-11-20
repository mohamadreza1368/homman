/**
 * Local Journal & Offline Vault Engine
 *
 * Implemented strictly from specs/local-journal-vault.md
 * Independent Clean-Room implementation for data export,
 * integrity verification, import diagnostics, and safe storage reset.
 */

export const CURRENT_VAULT_SCHEMA_VERSION = 1;
export const PURGE_CONFIRMATION_KEYWORD = 'DELETE';

export interface VaultNoteItem {
  readonly id: string;
  readonly content: string;
  readonly updatedAtMs?: number;
}

export interface VaultPinItem {
  readonly id: string;
  readonly titleFa: string;
  readonly metadata?: Record<string, unknown>;
}

export interface VaultExportPayload {
  readonly schemaVersion: number;
  readonly timestampMs: number;
  readonly notes: readonly VaultNoteItem[];
  readonly pins: readonly VaultPinItem[];
  readonly integrityHash: string;
}

export interface VaultImportOutcome {
  readonly isValid: boolean;
  readonly errorMessageFa?: string;
  readonly restoredNotes?: readonly VaultNoteItem[];
  readonly restoredPins?: readonly VaultPinItem[];
}

/**
 * Standard FNV-1a 32-bit hash algorithm for lightweight, deterministic offline checksums.
 */
export function calculatePayloadChecksum(serializedContent: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < serializedContent.length; i++) {
    hash ^= serializedContent.charCodeAt(i);
    // Multiply by 32-bit FNV prime (16777619)
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Serializes local notes and pins into an integrity-sealed export payload.
 */
export function createExportPackage(
  notes: readonly VaultNoteItem[],
  pins: readonly VaultPinItem[],
  currentTimeMs: number = Date.now()
): VaultExportPayload {
  const contentToHash = JSON.stringify({
    schemaVersion: CURRENT_VAULT_SCHEMA_VERSION,
    timestampMs: currentTimeMs,
    notes,
    pins,
  });

  const hash = calculatePayloadChecksum(contentToHash);

  return {
    schemaVersion: CURRENT_VAULT_SCHEMA_VERSION,
    timestampMs: currentTimeMs,
    notes,
    pins,
    integrityHash: hash,
  };
}

/**
 * Validates, checks integrity, and extracts contents from an imported JSON string.
 */
export function verifyAndImportPackage(rawJsonString: string): VaultImportOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonString);
  } catch {
    return {
      isValid: false,
      errorMessageFa: 'ساختار فایل معتبر نیست یا داده‌های متنی شکسته شده‌اند.',
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      isValid: false,
      errorMessageFa: 'محتوای واردشده یک شیء معتبر داده نیست.',
    };
  }

  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.schemaVersion !== 'number') {
    return {
      isValid: false,
      errorMessageFa: 'نسخه داده در فایل پشتیبان مشخص نیست.',
    };
  }

  if (candidate.schemaVersion > CURRENT_VAULT_SCHEMA_VERSION) {
    return {
      isValid: false,
      errorMessageFa: `این نسخه داده (${candidate.schemaVersion}) توسط نرم‌افزار فعلی پشتیبانی نمی‌شود.`,
    };
  }

  if (
    typeof candidate.timestampMs !== 'number' ||
    !Array.isArray(candidate.notes) ||
    !Array.isArray(candidate.pins) ||
    typeof candidate.integrityHash !== 'string'
  ) {
    return {
      isValid: false,
      errorMessageFa: 'فایل پشتیبان فاقد ساختار الزامی یا مقادیر داده است.',
    };
  }

  // Verify Checksum
  const contentToVerify = JSON.stringify({
    schemaVersion: candidate.schemaVersion,
    timestampMs: candidate.timestampMs,
    notes: candidate.notes,
    pins: candidate.pins,
  });

  const computedHash = calculatePayloadChecksum(contentToVerify);
  if (computedHash !== candidate.integrityHash) {
    return {
      isValid: false,
      errorMessageFa: 'کد اعتبارسنجی فایل مطابقت ندارد. داده‌ها تغییر یافته یا مخدوش شده‌اند.',
    };
  }

  return {
    isValid: true,
    restoredNotes: candidate.notes as VaultNoteItem[],
    restoredPins: candidate.pins as VaultPinItem[],
  };
}

/**
 * Checks safety confirmation token before allowing storage purge.
 */
export function isPurgeTokenAuthorized(confirmationToken: string): boolean {
  return confirmationToken.trim() === PURGE_CONFIRMATION_KEYWORD;
}

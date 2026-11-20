import { describe, it, expect } from 'vitest';
import {
  createExportPackage,
  verifyAndImportPackage,
  isPurgeTokenAuthorized,
  VaultNoteItem,
  VaultPinItem,
  CURRENT_VAULT_SCHEMA_VERSION,
} from './journalVaultEngine';

describe('JournalVaultEngine (Spec verification from specs/local-journal-vault.md)', () => {
  const sampleNotes: readonly VaultNoteItem[] = [
    { id: 'n1', content: 'نکته مربوط به دریچه میترال' },
  ];

  const samplePins: readonly VaultPinItem[] = [
    { id: 'p1', titleFa: 'نمای بطن' },
  ];

  it('Scenario 1: packages export data with version, timestamp, and integrity checksum', () => {
    const fixedTime = 1700000000000;
    const pkg = createExportPackage(sampleNotes, samplePins, fixedTime);

    expect(pkg.schemaVersion).toBe(CURRENT_VAULT_SCHEMA_VERSION);
    expect(pkg.timestampMs).toBe(fixedTime);
    expect(pkg.notes).toHaveLength(1);
    expect(pkg.pins).toHaveLength(1);
    expect(typeof pkg.integrityHash).toBe('string');
    expect(pkg.integrityHash.length).toBe(8);
  });

  it('Scenario 2: verifies and imports valid serialized JSON package', () => {
    const pkg = createExportPackage(sampleNotes, samplePins, 1700000000000);
    const serialized = JSON.stringify(pkg);

    const outcome = verifyAndImportPackage(serialized);
    expect(outcome.isValid).toBe(true);
    expect(outcome.restoredNotes).toHaveLength(1);
    expect(outcome.restoredNotes?.[0]?.content).toBe('نکته مربوط به دریچه میترال');
    expect(outcome.restoredPins).toHaveLength(1);
    expect(outcome.restoredPins?.[0]?.titleFa).toBe('نمای بطن');
  });

  it('Scenario 3: rejects tampered package where content was modified without matching checksum', () => {
    const pkg = createExportPackage(sampleNotes, samplePins, 1700000000000);
    // Maliciously tamper content
    const tamperedPkg = {
      ...pkg,
      notes: [{ id: 'n1', content: 'محتوای دستکاری‌شده غیرمجاز' }],
    };
    const serialized = JSON.stringify(tamperedPkg);

    const outcome = verifyAndImportPackage(serialized);
    expect(outcome.isValid).toBe(false);
    expect(outcome.errorMessageFa).toContain('تغییر یافته');
  });

  it('Edge Case A: broken JSON strings report informative error without crashing', () => {
    const outcome = verifyAndImportPackage('{ broken json ...');
    expect(outcome.isValid).toBe(false);
    expect(outcome.errorMessageFa).toContain('شکسته');
  });

  it('Edge Case B: rejects higher unsupported schema versions', () => {
    const futurePkg = {
      schemaVersion: 99,
      timestampMs: 1700000000000,
      notes: [],
      pins: [],
      integrityHash: 'deadbeef',
    };

    const outcome = verifyAndImportPackage(JSON.stringify(futurePkg));
    expect(outcome.isValid).toBe(false);
    expect(outcome.errorMessageFa).toContain('پشتیبانی نمی‌شود');
  });

  it('Edge Case C: verifies strict DELETE token for storage purge authorization', () => {
    expect(isPurgeTokenAuthorized('DELETE')).toBe(true);
    expect(isPurgeTokenAuthorized('delete')).toBe(false);
    expect(isPurgeTokenAuthorized('del')).toBe(false);
    expect(isPurgeTokenAuthorized('')).toBe(false);
  });
});

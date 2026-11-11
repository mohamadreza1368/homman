import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISCLAIMER_STORAGE_KEY,
  DISCLAIMER_VERSION,
  loadDisclaimerAcceptance,
  saveDisclaimerAcceptance,
} from '../data/disclaimerState.ts';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

test('Disclaimer state requires explicit acceptance and persists versioned acknowledgment', () => {
  const storage = new MemoryStorage();
  assert.equal(loadDisclaimerAcceptance(storage), null);

  const saved = saveDisclaimerAcceptance(storage);
  assert.equal(saved.accepted, true);
  assert.equal(saved.version, DISCLAIMER_VERSION);

  const loaded = loadDisclaimerAcceptance(storage);
  assert.ok(loaded);
  assert.equal(loaded.accepted, true);
  assert.equal(loaded.version, DISCLAIMER_VERSION);

  // Version mismatch invalidates prior consent cleanly
  storage.setItem(
    DISCLAIMER_STORAGE_KEY,
    JSON.stringify({ accepted: true, version: '0.0.1', acceptedAt: '2025-01-01T00:00:00Z' })
  );
  assert.equal(loadDisclaimerAcceptance(storage), null);
});

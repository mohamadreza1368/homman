/**
 * Undoable memory disposal management queue.
 *
 * Implements a grace period mechanism so that user-initiated erasures in MemoryLab
 * are not instantly executed in the persistent journal database. While pending,
 * the memory item may be restored by user action or will be flushed automatically
 * on session termination.
 */

export const RESTORE_WINDOW_S = 8;

export interface PendingErase {
  key: string;
  deadline: number;
}

export class EraseQueue {
  private readonly items = new Map<string, PendingErase>();

  erase(key: string, nowMs: number): PendingErase {
    const record: PendingErase = {
      key,
      deadline: nowMs + RESTORE_WINDOW_S * 1000,
    };
    this.items.set(key, record);
    return record;
  }

  restore(key: string): boolean {
    return this.items.delete(key);
  }

  isPending(key: string): boolean {
    return this.items.has(key);
  }

  secondsLeft(key: string, nowMs: number): number {
    const entry = this.items.get(key);
    if (!entry) return 0;
    const diff = entry.deadline - nowMs;
    return diff <= 0 ? 0 : Math.ceil(diff / 1000);
  }

  due(nowMs: number): string[] {
    const expired: string[] = [];
    for (const [key, item] of this.items) {
      if (item.deadline <= nowMs) {
        expired.push(key);
        this.items.delete(key);
      }
    }
    return expired;
  }

  flush(): string[] {
    const snapshot = Array.from(this.items.keys());
    this.items.clear();
    return snapshot;
  }
}

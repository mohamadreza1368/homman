import { invoke } from "@tauri-apps/api/core";

import { isTauriContext } from "./ipc";

export interface LogEntry {
  at: number;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
}

/**
 * Dispatches an event log asynchronously to native persistent storage without blocking.
 */
export function logEvent(
  level: LogEntry["level"],
  source: string,
  message: string,
): void {
  if (!isTauriContext()) return;
  try {
    const dispatch = invoke("log_event", { level, source, message });
    dispatch?.catch?.(() => {});
  } catch {
    // Non-blocking diagnostic suppression
  }
}

export function readLog(): Promise<LogEntry[]> {
  if (!isTauriContext()) return Promise.resolve([]);
  return invoke("read_log");
}

export function logLocation(): Promise<string | null> {
  if (!isTauriContext()) return Promise.resolve(null);
  return invoke("log_location");
}

export function clearLog(): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("clear_log");
}

export function saveLogCopy(contents: string): Promise<string | null> {
  if (!isTauriContext()) return Promise.resolve(null);
  return invoke("save_log_copy", { contents });
}

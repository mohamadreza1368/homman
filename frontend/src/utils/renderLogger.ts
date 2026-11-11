/**
 * Lightweight structured logger for runtime rendering, asset download telemetry,
 * and WebGL context diagnostics. Intentionally never logs or stores PII/PHI.
 */

export type RenderLogLevel = 'info' | 'warn' | 'error';

export interface RenderLogEntry {
  timestamp: string;
  level: RenderLogLevel;
  category: 'asset_load' | 'webgl' | 'mapping' | 'render_loop';
  message: string;
  meta?: Record<string, string | number | boolean>;
}

const MAX_LOG_ENTRIES = 100;
const logBuffer: RenderLogEntry[] = [];

export function logRenderEvent(
  level: RenderLogLevel,
  category: RenderLogEntry['category'],
  message: string,
  meta?: Record<string, string | number | boolean>
): void {
  const entry: RenderLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    meta,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }

  const prefix = `[Homman:${category}]`;
  if (level === 'error') {
    console.error(prefix, message, meta ?? '');
  } else if (level === 'warn') {
    console.warn(prefix, message, meta ?? '');
  } else {
    console.info(prefix, message, meta ?? '');
  }
}

export function getRenderLogs(): readonly RenderLogEntry[] {
  return logBuffer;
}

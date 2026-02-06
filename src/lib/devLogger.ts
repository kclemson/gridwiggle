/**
 * Development-only logger with in-memory collection.
 * 
 * Usage:
 *   devLogger.log('layout', 'Row selection', { heroAR: 0.67, optimalRows: 2 });
 *   devLogger.clear();
 *   const logs = devLogger.getLogs();
 * 
 * - Only active in dev mode (no-op in production)
 * - Outputs to console.log (visible in F12 by default)
 * - Accumulates entries for UI consumption
 */

export interface LogEntry {
  timestamp: number;
  category: string;
  label: string;
  data: Record<string, unknown>;
}

const isDev = import.meta.env.DEV;
let logs: LogEntry[] = [];

export const devLogger = {
  log(category: string, label: string, data: Record<string, unknown> = {}) {
    if (!isDev) return;
    console.log(`[${category}] ${label}`, data);
    logs.push({ timestamp: Date.now(), category, label, data });
  },

  clear() {
    logs = [];
  },

  getLogs(): LogEntry[] {
    return logs;
  },
};

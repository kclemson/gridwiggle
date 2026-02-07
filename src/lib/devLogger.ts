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
  level?: 'info' | 'warn' | 'error';
}

const isDev = import.meta.env.DEV;
let logs: LogEntry[] = [];
let collector: ((entry: LogEntry) => void) | null = null;

export const devLogger = {
  log(category: string, label: string, data: Record<string, unknown> = {}, level: 'info' | 'warn' | 'error' = 'info') {
    if (!isDev) return;
    
    const entry: LogEntry = { timestamp: Date.now(), category, label, data, level };
    
    // Collector mode (worker) - skip console, just collect
    if (collector) {
      collector(entry);
      return;
    }
    
    // Normal mode - console + local array
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(`[${category}] ${label}`, data);
    logs.push(entry);
  },

  warn(category: string, label: string, data: Record<string, unknown> = {}) {
    this.log(category, label, data, 'warn');
  },

  error(category: string, label: string, data: Record<string, unknown> = {}) {
    this.log(category, label, data, 'error');
  },

  // Set collector for worker contexts (pass null to clear)
  setCollector(fn: ((entry: LogEntry) => void) | null) {
    collector = fn;
  },

  // Check if in collector mode
  hasCollector(): boolean {
    return collector !== null;
  },

  clear() {
    logs = [];
  },

  getLogs(): LogEntry[] {
    return logs;
  },
};

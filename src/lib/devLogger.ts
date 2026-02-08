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

/** Geometry for rejected layout visualization */
export interface RejectedLayoutGeometry {
  cells: Array<{ photoId: string; x: number; y: number; width: number; height: number }>;
  canvasWidth: number;
  canvasHeight: number;
}

export interface LogEntry {
  timestamp: number;
  category: string;
  label: string;
  data: Record<string, unknown>;
  level?: 'info' | 'warn' | 'error';
  /** Optional geometry for rejected layouts (hover preview) */
  rejectedLayout?: RejectedLayoutGeometry;
}

const isDev = import.meta.env.DEV;
let logs: LogEntry[] = [];
let collector: ((entry: LogEntry) => void) | null = null;

export const devLogger = {
  log(
    category: string, 
    label: string, 
    data: Record<string, unknown> = {}, 
    levelOrGeometry: 'info' | 'warn' | 'error' | RejectedLayoutGeometry = 'info',
    geometry?: RejectedLayoutGeometry
  ) {
    if (!isDev) return;
    
    // Handle overloaded signature: level can be geometry if 4th arg is object
    let level: 'info' | 'warn' | 'error' = 'info';
    let rejectedLayout: RejectedLayoutGeometry | undefined;
    
    if (typeof levelOrGeometry === 'object') {
      rejectedLayout = levelOrGeometry;
    } else {
      level = levelOrGeometry;
      rejectedLayout = geometry;
    }
    
    const entry: LogEntry = { timestamp: Date.now(), category, label, data, level, rejectedLayout };
    
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

  warn(category: string, label: string, data: Record<string, unknown> = {}, geometry?: RejectedLayoutGeometry) {
    this.log(category, label, data, 'warn', geometry);
  },

  error(category: string, label: string, data: Record<string, unknown> = {}, geometry?: RejectedLayoutGeometry) {
    this.log(category, label, data, 'error', geometry);
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

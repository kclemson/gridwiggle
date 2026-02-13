/**
 * Layout Capture Storage
 * 
 * Manages localStorage persistence for layout generation metadata.
 * Captures are saved on every shuffle for later bulk analysis.
 */

import { LogEntry } from './devLogger';

export interface LayoutCapture {
  // Inputs
  photoCount: number;
  heroCount: number;
  heroAR: number | null;
  avgAR: number;
  orientationBias: number;
  seed: number;
  
  // Outputs
  success: boolean;
  canvasWidth: number | null;
  canvasHeight: number | null;
  canvasAR: number | null;
  cellCount: number | null;
  
  // Log metrics with reason breakdowns
  logCount: number;
  rejectCount: number;
  rejectReasons: Record<string, number>;
  feasibilityCount: number;
  feasibilityReasons: Record<string, number>;
  durationMs: number;
  
  // Failure info
  failureReason: string | null;
  failureDetails: Record<string, unknown> | null;
  
  // Rejected layout geometry (for visualization/debugging)
  rejectedCells: Array<{
    photoId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }> | null;
  rejectedCanvasWidth: number | null;
  rejectedCanvasHeight: number | null;
  
  // Metadata
  capturedAt: string;
  exported: boolean;
}

interface CaptureStore {
  captures: LayoutCapture[];
  lastExportedAt: string | null;
}

const STORAGE_KEY = 'layout-captures';
const OLD_STORAGE_KEY = 'v3-layout-captures';

/**
 * Load captures from localStorage.
 */
export function loadCaptures(): CaptureStore {
  try {
    // Migration: check for old key first
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldRaw) {
      localStorage.setItem(STORAGE_KEY, oldRaw);
      localStorage.removeItem(OLD_STORAGE_KEY);
    }
    
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { captures: [], lastExportedAt: null };
    }
    return JSON.parse(raw) as CaptureStore;
  } catch {
    console.warn('Failed to load captures from localStorage');
    return { captures: [], lastExportedAt: null };
  }
}

/**
 * Save captures to localStorage.
 */
function saveStore(store: CaptureStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('Failed to save captures to localStorage', e);
  }
}

/**
 * Save a new capture (sets exported: false).
 */
export function saveCapture(capture: Omit<LayoutCapture, 'exported'>): void {
  const store = loadCaptures();
  store.captures.push({ ...capture, exported: false });
  saveStore(store);
}

/**
 * Export pending captures, mark them as exported, return data.
 */
export function exportPendingCaptures(): { data: LayoutCapture[]; count: number } {
  const store = loadCaptures();
  const pending = store.captures.filter(c => !c.exported);
  
  if (pending.length === 0) {
    return { data: [], count: 0 };
  }
  
  // Mark all as exported
  store.captures = store.captures.map(c => ({ ...c, exported: true }));
  store.lastExportedAt = new Date().toISOString();
  saveStore(store);
  
  return { data: pending, count: pending.length };
}

/**
 * Get capture stats for UI badge (includes success count for pending).
 */
export function getCaptureStats(): { 
  total: number; 
  pending: number; 
  pendingSuccessCount: number;
} {
  const store = loadCaptures();
  const pendingCaptures = store.captures.filter(c => !c.exported);
  const pendingSuccessCount = pendingCaptures.filter(c => c.success).length;
  return { 
    total: store.captures.length, 
    pending: pendingCaptures.length,
    pendingSuccessCount,
  };
}

/**
 * Extract reason frequencies from logs.
 * Parses log entries to build frequency maps of reject/feasibility reasons.
 */
export function extractReasonFrequencies(logs: LogEntry[]): {
  rejectReasons: Record<string, number>;
  feasibilityReasons: Record<string, number>;
  rejectCount: number;
  feasibilityCount: number;
} {
  const rejectReasons: Record<string, number> = {};
  const feasibilityReasons: Record<string, number> = {};
  let rejectCount = 0;
  let feasibilityCount = 0;
  
  for (const entry of logs) {
    const isReject = entry.level === 'warn' || entry.level === 'error' 
      || entry.category.includes('reject');
    const isFeasibility = entry.category === 'feasibility';
    
    // Use label as the reason key (normalized to snake_case)
    const reason = entry.label.toLowerCase().replace(/\s+/g, '_');
    
    if (isReject) {
      rejectReasons[reason] = (rejectReasons[reason] || 0) + 1;
      rejectCount++;
    } else if (isFeasibility) {
      feasibilityReasons[reason] = (feasibilityReasons[reason] || 0) + 1;
      feasibilityCount++;
    }
  }
  
  return { rejectReasons, feasibilityReasons, rejectCount, feasibilityCount };
}

/**
 * Get the last rejection log entry (for failure details).
 */
export function getLastRejection(logs: LogEntry[]): { reason: string; details: Record<string, unknown> } | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const entry = logs[i];
    const isReject = entry.level === 'warn' || entry.level === 'error' 
      || entry.category.includes('reject');
    if (isReject) {
      return {
        reason: entry.label.toLowerCase().replace(/\s+/g, '_'),
        details: entry.data,
      };
    }
  }
  return null;
}

/**
 * Clear all captures from localStorage.
 */
export function clearCaptures(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY); // Clean up old key too
  } catch (e) {
    console.warn('Failed to clear captures from localStorage', e);
  }
}

/**
 * Trigger a JSON download of the given data.
 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

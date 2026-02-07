/**
 * Layout Worker
 * 
 * Runs V3 layout generation off the main thread so the UI stays responsive
 * and spinners can animate during computation.
 */

import { PhotoDimension, V3Tuning, DEFAULT_V3_TUNING } from '@/lib/v3/types';
import { CollageLayout, CollageCell } from '@/types/collage';
import { findValidConfiguration, getLastRejection, clearRejections } from '@/lib/v3/intersection';
import { LogEntry } from '@/lib/devLogger';

// Virtual canvas base unit - normalized dimensions are scaled to this
const VIRTUAL_CANVAS_BASE = 1000;

// ============================================================================
// Worker-local dev logger (collects logs to send back to main thread)
// ============================================================================

const isDev = import.meta.env.DEV;
let logs: LogEntry[] = [];

const workerLogger = {
  log(category: string, label: string, data: Record<string, unknown> = {}) {
    if (!isDev) return;
    logs.push({ timestamp: Date.now(), category, label, data });
  },
  clear() {
    logs = [];
  },
  getLogs(): LogEntry[] {
    return logs;
  },
};

// ============================================================================
// Message Types
// ============================================================================

export interface LayoutRequest {
  type: 'generate';
  requestId: string;
  dimensions: PhotoDimension[];
  normalizedGap: number;
  tuning: Partial<V3Tuning>;
  randomize: boolean;
}

export interface LayoutResponse {
  type: 'result';
  requestId: string;
  layout: CollageLayout | null;
  durationMs: number;
  logs?: LogEntry[];
  failure?: { reason: string; details?: Record<string, unknown> };
}

// ============================================================================
// Helpers (duplicated from v3/index.ts to avoid import issues)
// ============================================================================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// Layout Generation
// ============================================================================

function generateLayout(
  dimensions: PhotoDimension[],
  normalizedGap: number,
  tuningOverrides: Partial<V3Tuning>,
  randomize: boolean
): CollageLayout | null {
  if (dimensions.length < 2) return null;
  
  const tuning: V3Tuning = { ...DEFAULT_V3_TUNING, ...tuningOverrides };
  
  workerLogger.log('v3', 'Starting V3 layout generation (worker)', {
    photoCount: dimensions.length,
    tuning: {
      hero_targetProminence: tuning.hero_targetProminence,
      hero_minProminence: tuning.hero_minProminence,
    },
  });
  
  // Shuffle for variety when requested
  let dims = randomize ? shuffleArray(dimensions) : dimensions;
  
  // Check for hero
  const heroCount = dims.filter(d => d.weight > 1).length;
  
  workerLogger.log('v3', 'Photo analysis', {
    heroCount,
    contentCount: dims.length - heroCount,
    avgAR: dims.reduce((s, d) => s + d.aspectRatio, 0) / dims.length,
  });
  
  // Clear rejection tracking before search
  clearRejections();
  
  // Find valid configuration through constraint intersection
  const config = findValidConfiguration(dims, normalizedGap, tuning, randomize);
  
  if (!config) {
    workerLogger.log('v3', 'No valid configuration found');
    return null;
  }
  
  workerLogger.log('v3', 'Selected layout', {
    mode: config.proposal.mode,
    position: config.proposal.position,
    prominenceRatio: config.prominenceRatio.toFixed(2),
    score: config.score.toFixed(3),
  });
  
  // Convert to CollageLayout format
  const cells: CollageCell[] = config.cells.map(cell => ({
    photoId: cell.photoId,
    x: cell.x * VIRTUAL_CANVAS_BASE,
    y: cell.y * VIRTUAL_CANVAS_BASE,
    width: cell.width * VIRTUAL_CANVAS_BASE,
    height: cell.height * VIRTUAL_CANVAS_BASE,
  }));
  
  workerLogger.log('v3', 'Final layout dimensions', {
    width: config.canvasWidth.toFixed(3),
    height: config.canvasHeight.toFixed(3),
    aspectRatio: (config.canvasWidth / config.canvasHeight).toFixed(2),
  });
  
  return {
    width: Math.round(config.canvasWidth * VIRTUAL_CANVAS_BASE),
    height: Math.round(config.canvasHeight * VIRTUAL_CANVAS_BASE),
    cells,
  };
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
  const { type, requestId, dimensions, normalizedGap, tuning, randomize } = e.data;
  
  if (type !== 'generate') {
    return;
  }
  
  const startTime = performance.now();
  workerLogger.clear();
  
  try {
    const layout = generateLayout(dimensions, normalizedGap, tuning, randomize);
    const durationMs = performance.now() - startTime;
    
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout,
      durationMs,
      logs: isDev ? workerLogger.getLogs() : undefined,
    };
    
    if (!layout) {
      const rejection = getLastRejection();
      const avgAR = dimensions.reduce((s, d) => s + d.aspectRatio, 0) / dimensions.length;
      response.failure = {
        reason: rejection?.reason ?? 'No valid proposals',
        details: {
          photoCount: dimensions.length,
          heroCount: dimensions.filter(d => d.weight > 1).length,
          avgAR: +avgAR.toFixed(2),
          ...rejection?.details,
        },
      };
    }
    
    self.postMessage(response);
  } catch (error) {
    const durationMs = performance.now() - startTime;
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: null,
      durationMs,
      logs: isDev ? workerLogger.getLogs() : undefined,
      failure: {
        reason: error instanceof Error ? error.message : 'Unknown error',
        details: { stack: error instanceof Error ? error.stack : undefined },
      },
    };
    self.postMessage(response);
  }
};

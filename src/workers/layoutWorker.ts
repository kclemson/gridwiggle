/**
 * Layout Worker
 * 
 * Runs V3 layout generation off the main thread so the UI stays responsive
 * and spinners can animate during computation.
 */

import { PhotoDimension, V3Tuning, DEFAULT_V3_TUNING } from '@/lib/v3/types';
import { CollageLayout, CollageCell } from '@/types/collage';
import { findValidConfiguration, clearRejections } from '@/lib/v3/intersection';
import { devLogger, LogEntry } from '@/lib/devLogger';

// Virtual canvas base unit - normalized dimensions are scaled to this
const VIRTUAL_CANVAS_BASE = 1000;

// ============================================================================
// Worker-local log collection (redirects devLogger to worker-local array)
// ============================================================================

const isDev = import.meta.env.DEV;
let workerLogs: LogEntry[] = [];

// Redirect all devLogger calls to worker-local array
devLogger.setCollector((entry) => {
  workerLogs.push(entry);
});

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
  layout: CollageLayout;  // Always non-null now (soft rejections instead of hard)
  durationMs: number;
  logs?: LogEntry[];
  /** Soft rejection info (layout is usable but outside ideal bounds) - dev-only display */
  softRejection?: {
    reason: string;
    details: Record<string, unknown>;
  };
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
// Layout Generation Result
// ============================================================================

interface GenerationResult {
  layout: CollageLayout | null;
  softRejection?: { reason: string; details: Record<string, unknown> };
}

// ============================================================================
// Layout Generation
// ============================================================================

function generateLayout(
  dimensions: PhotoDimension[],
  normalizedGap: number,
  tuningOverrides: Partial<V3Tuning>,
  randomize: boolean
): GenerationResult {
  // Clear worker logs at start of each generation
  workerLogs = [];
  
  // Edge case: <2 photos - return minimal empty layout with soft rejection
  if (dimensions.length < 2) {
    return { 
      layout: { width: 1000, height: 1000, cells: [] }, 
      softRejection: { reason: 'insufficient_photos', details: { photoCount: dimensions.length } },
    };
  }
  
  const tuning: V3Tuning = { ...DEFAULT_V3_TUNING, ...tuningOverrides };
  
  devLogger.log('v3', 'Starting V3 layout generation (worker)', {
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
  
  devLogger.log('v3', 'Photo analysis', {
    heroCount,
    contentCount: dims.length - heroCount,
    avgAR: dims.reduce((s, d) => s + d.aspectRatio, 0) / dims.length,
  });
  
  // Clear rejection tracking before search
  clearRejections();
  
  // Find valid configuration through constraint intersection
  // Config is always non-null now (soft rejections instead of hard)
  // All devLogger.log() calls from v3/*.ts now go to workerLogs
  const config = findValidConfiguration(dims, normalizedGap, tuning, randomize);
  
  devLogger.log('v3', 'Selected layout', {
    mode: config.proposal.mode,
    position: config.proposal.position,
    prominenceRatio: config.prominenceRatio.toFixed(2),
    score: config.score.toFixed(3),
    hasSoftRejection: !!config.softRejection,
  });
  
  // Convert to CollageLayout format
  const cells: CollageCell[] = config.cells.map(cell => ({
    photoId: cell.photoId,
    x: cell.x * VIRTUAL_CANVAS_BASE,
    y: cell.y * VIRTUAL_CANVAS_BASE,
    width: cell.width * VIRTUAL_CANVAS_BASE,
    height: cell.height * VIRTUAL_CANVAS_BASE,
  }));
  
  devLogger.log('v3', 'Final layout dimensions', {
    width: config.canvasWidth.toFixed(3),
    height: config.canvasHeight.toFixed(3),
    aspectRatio: (config.canvasWidth / config.canvasHeight).toFixed(2),
  });
  
  return {
    layout: {
      width: Math.round(config.canvasWidth * VIRTUAL_CANVAS_BASE),
      height: Math.round(config.canvasHeight * VIRTUAL_CANVAS_BASE),
      cells,
    },
    softRejection: config.softRejection,
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
  
  try {
    // generateLayout clears workerLogs at start
    const result = generateLayout(dimensions, normalizedGap, tuning, randomize);
    const durationMs = performance.now() - startTime;
    
    // Layout is now always non-null (soft rejections instead of hard)
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: result.layout!,
      durationMs,
      logs: isDev ? workerLogs : undefined,
      softRejection: result.softRejection,
    };
    
    self.postMessage(response);
  } catch (error) {
    // For true errors (crashes), create a minimal empty layout
    // This should be extremely rare - log for debugging
    console.error('Layout worker error:', error);
    const durationMs = performance.now() - startTime;
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: { width: 1000, height: 1000, cells: [] },  // Empty fallback layout
      durationMs,
      logs: isDev ? workerLogs : undefined,
      softRejection: {
        reason: 'worker_error',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    };
    self.postMessage(response);
  }
};

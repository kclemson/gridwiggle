/**
 * Layout Worker (thin message handler)
 * 
 * Runs V4 layout generation off the main thread so the UI stays responsive.
 * All algorithm logic lives in @/lib/v4/engine.ts (single source of truth).
 */

import { PhotoDimension, V3Tuning } from '@/lib/v3/types';
import { CollageLayout } from '@/types/collage';
import { devLogger, LogEntry } from '@/lib/devLogger';
import { generateLayoutFromDimensions } from '@/lib/v4/engine';

// ============================================================================
// Worker-local log collection (redirects devLogger to worker-local array)
// ============================================================================

const isDev = import.meta.env.DEV;
let workerLogs: LogEntry[] = [];

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
  layout: CollageLayout;
  durationMs: number;
  logs?: LogEntry[];
  softRejection?: {
    reason: string;
    details: Record<string, unknown>;
  };
  layoutMeta?: Record<string, unknown>;
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
  const { type, requestId, dimensions, normalizedGap, tuning, randomize } = e.data;
  
  if (type !== 'generate') return;
  
  workerLogs = [];
  const startTime = performance.now();
  
  try {
    const result = generateLayoutFromDimensions(dimensions, normalizedGap, tuning, randomize);
    const durationMs = performance.now() - startTime;
    
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: result.layout,
      durationMs,
      logs: isDev ? workerLogs : undefined,
      softRejection: result.softRejection,
      layoutMeta: result.layoutMeta,
    };
    
    self.postMessage(response);
  } catch (error) {
    console.error('Layout worker error:', error);
    const durationMs = performance.now() - startTime;
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: { width: 1000, height: 1000, cells: [] },
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

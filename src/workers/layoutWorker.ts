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
import { generateSingleStripeLayout, StripeDirection } from '@/lib/v4/singleStripe';

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
  /** When set, bypass V4 engine and produce a single column/row layout. */
  singleStripe?: StripeDirection;
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
  const { type, requestId, dimensions, normalizedGap, tuning, randomize, singleStripe } = e.data;
  
  if (type !== 'generate') return;
  
  workerLogs = [];
  const startTime = performance.now();
  
  try {
    let layout;
    let softRejection;
    let layoutMeta;
    if (singleStripe) {
      layout = generateSingleStripeLayout(dimensions, normalizedGap, singleStripe);
      layoutMeta = { mode: `single-${singleStripe}`, photoCount: dimensions.length };
    } else {
      const result = generateLayoutFromDimensions(dimensions, normalizedGap, tuning, randomize);
      layout = result.layout;
      softRejection = result.softRejection;
      layoutMeta = result.layoutMeta;
    }
    const durationMs = performance.now() - startTime;
    
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout,
      durationMs,
      logs: isDev ? workerLogs : undefined,
      softRejection,
      layoutMeta,
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

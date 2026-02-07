/**
 * Layout Generation Service
 * 
 * Manages a singleton Web Worker for V3 layout generation.
 * Falls back to synchronous generation if workers aren't supported.
 */

import { PhotoDimension, V3Tuning } from '@/lib/v3/types';
import { CollageLayout } from '@/types/collage';
import { LogEntry } from '@/lib/devLogger';
import type { LayoutRequest, LayoutResponse } from '@/workers/layoutWorker';

// ============================================================================
// Types
// ============================================================================

export interface LayoutGenerationPayload {
  dimensions: PhotoDimension[];
  normalizedGap: number;
  tuning: Partial<V3Tuning>;
  randomize: boolean;
}

export interface LayoutGenerationResult {
  layout: CollageLayout | null;
  durationMs: number;
  logs?: LogEntry[];
  failure?: { reason: string; details?: Record<string, unknown> };
  usedWorker: boolean;
}

// ============================================================================
// Worker Management
// ============================================================================

let worker: Worker | null = null;
let workerSupported = true;

function getWorker(): Worker | null {
  if (!workerSupported) return null;
  
  if (!worker) {
    try {
      worker = new Worker(
        new URL('../workers/layoutWorker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (e) {
      console.warn('Layout worker not supported:', e);
      workerSupported = false;
      return null;
    }
  }
  return worker;
}

function resetWorker() {
  if (worker) {
    try {
      worker.terminate();
    } catch (e) {
      // Ignore termination errors
    }
    worker = null;
  }
}

// ============================================================================
// Request Counter
// ============================================================================

let requestCounter = 0;

function nextRequestId(): string {
  return `layout-${++requestCounter}-${Date.now()}`;
}

// ============================================================================
// Synchronous Fallback
// ============================================================================

async function generateLayoutSync(
  payload: LayoutGenerationPayload
): Promise<LayoutGenerationResult> {
  // Dynamic import to avoid bundling issues
  const { generateCollageLayoutV3 } = await import('@/lib/v3');
  
  const startTime = performance.now();
  
  // Build mock PhotoItem array (only needs id, originalWidth/Height, and crop fields)
  const mockPhotos = payload.dimensions.map(d => ({
    id: d.id,
    objectUrl: '',
    blob: new Blob(),
    originalWidth: 1000,  // Normalized
    originalHeight: 1000 / d.aspectRatio,
    smartCrop: null,
    manualCrop: null,
    isProcessing: false,
    error: null,
    priority: d.weight > 1 ? 1 : 3,
  })) as any[];
  
  const photoWeights: Record<string, number> = {};
  for (const d of payload.dimensions) {
    photoWeights[d.id] = d.weight;
  }
  
  const layout = generateCollageLayoutV3(
    mockPhotos,
    { shape: 'auto', gapColor: '#ffffff', gapSize: payload.normalizedGap * 100 / 0.04 },
    { photoWeights, randomize: payload.randomize, tuning: payload.tuning }
  );
  
  const durationMs = performance.now() - startTime;
  
  return {
    layout,
    durationMs,
    usedWorker: false,
  };
}

// ============================================================================
// Worker-based Generation
// ============================================================================

const TIMEOUT_MS = 10000;  // 10 second timeout

export async function generateLayoutInWorker(
  payload: LayoutGenerationPayload
): Promise<LayoutGenerationResult> {
  const currentWorker = getWorker();
  
  // Fall back to sync if worker not available
  if (!currentWorker) {
    return generateLayoutSync(payload);
  }
  
  const requestId = nextRequestId();
  
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resetWorker();
      console.warn('Layout worker timeout, falling back to sync');
      // Fall back to sync on timeout
      generateLayoutSync(payload).then(resolve);
    }, TIMEOUT_MS);
    
    const cleanup = () => {
      clearTimeout(timeoutId);
      currentWorker.removeEventListener('message', handleMessage);
      currentWorker.removeEventListener('error', handleError);
    };
    
    const handleMessage = (e: MessageEvent<LayoutResponse>) => {
      // Ignore messages for other requests
      if (e.data.requestId !== requestId) return;
      
      cleanup();
      
      resolve({
        layout: e.data.layout,
        durationMs: e.data.durationMs,
        logs: e.data.logs,
        failure: e.data.failure,
        usedWorker: true,
      });
    };
    
    const handleError = (errorEvent: ErrorEvent) => {
      console.error('Layout worker crashed:', errorEvent);
      cleanup();
      resetWorker();
      // Fall back to sync on crash
      generateLayoutSync(payload).then(resolve);
    };
    
    currentWorker.addEventListener('message', handleMessage);
    currentWorker.addEventListener('error', handleError);
    
    const request: LayoutRequest = {
      type: 'generate',
      requestId,
      dimensions: payload.dimensions,
      normalizedGap: payload.normalizedGap,
      tuning: payload.tuning,
      randomize: payload.randomize,
    };
    
    currentWorker.postMessage(request);
  });
}

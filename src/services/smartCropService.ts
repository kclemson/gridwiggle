import { CropRegion } from '@/types/collage';
import { remoteLogger } from '@/lib/remoteLogger';
import { isMobileDevice } from '@/lib/platform';
import { getServerSmartCrop } from '@/services/serverSmartCropService';

// ============================================================================
// Types
// ============================================================================

export interface SmartCropInput {
  id: string;
  objectUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface SmartCropBatchResult {
  id: string;
  crop: CropRegion;
  confidence: number;
  subjects: string;
  skipCrop: boolean;
}

interface SmartCropResult {
  crop: CropRegion;
  confidence: number;
  subjects: string;
  skipCrop: boolean;
}

interface WorkerStatusCallback {
  (status: string): void;
}

// Create worker singleton
let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (!worker) {
    try {
      remoteLogger.info('vision', 'Creating worker', {
        moduleSupport: typeof Worker !== 'undefined',
      });
      
      worker = new Worker(
        new URL('../workers/visionWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      remoteLogger.info('vision', 'Worker created successfully', {});
    } catch (e) {
      remoteLogger.error('vision', 'Worker creation failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      console.warn('Module worker not supported:', e);
      return null;
    }
  }
  return worker;
}

// Reset worker on crash so next attempt uses fresh worker
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

/**
 * Get smart crop for a photo using AI vision.
 * Accepts objectUrl (for rendering) and blob (for processing).
 * Blob is passed directly to the worker - no base64 conversion needed.
 */
export async function getSmartCrop(
  objectUrl: string,
  blob: Blob,
  width: number,
  height: number,
  onStatus?: WorkerStatusCallback
): Promise<SmartCropResult> {
  // Mobile devices route to server-side inference to avoid Safari WASM crashes
  if (isMobileDevice()) {
    remoteLogger.info('vision-svc', 'Routing to server (mobile device)', { width, height });
    return getServerSmartCrop(objectUrl, blob, width, height, onStatus);
  }

  remoteLogger.info('vision-svc', 'getSmartCrop entry', {
    blobSize: blob?.size ?? -1,
    blobType: blob?.type ?? 'none',
    width,
    height,
  });

  // Check worker availability first - fail fast with fallback
  const currentWorker = getWorker();
  remoteLogger.info('vision-svc', 'Worker check', { available: !!currentWorker });
  
  if (!currentWorker) {
    onStatus?.('Using full image (AI unavailable)');
    return {
      crop: { x: 0, y: 0, width, height },
      confidence: 0,
      subjects: 'AI unavailable',
      skipCrop: true,
    };
  }

  return new Promise((resolve, reject) => {
    
    // Timeout after 60 seconds (model download + processing)
    const timeoutId = setTimeout(() => {
      remoteLogger.error('vision-svc', 'Timeout after 60s', { width, height });
      cleanup();
      resetWorker();
      reject(new Error('Processing timeout - please try again'));
    }, 60000);
    
    // Cleanup function to remove all listeners
    const cleanup = () => {
      clearTimeout(timeoutId);
      currentWorker.removeEventListener('message', handleMessage);
      currentWorker.removeEventListener('error', handleError);
    };
    
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        remoteLogger.info('vision-svc', 'Result received', {
          skipCrop: e.data.skipCrop ?? false,
          confidence: e.data.confidence,
          subjects: e.data.subjects,
        });
        cleanup();
        resolve({
          crop: e.data.crop,
          confidence: e.data.confidence,
          subjects: e.data.subjects,
          skipCrop: e.data.skipCrop ?? false,
        });
      } else if (e.data.type === 'error') {
        remoteLogger.error('vision-svc', 'Worker error message', { error: e.data.error });
        cleanup();
        resetWorker();
        reject(new Error(e.data.error));
      } else if (e.data.type === 'status' && onStatus) {
        onStatus(e.data.message);
      }
    };
    
    // Handle worker-level crashes (OOM, uncaught exceptions)
    // Resolve with fallback instead of rejecting - allows processing to continue
    const handleError = (errorEvent: ErrorEvent) => {
      remoteLogger.error('vision-svc', 'Worker crash', {
        message: errorEvent?.message ?? 'unknown',
        filename: errorEvent?.filename ?? 'unknown',
        lineno: errorEvent?.lineno ?? -1,
      });
      console.error('Vision worker crashed:', errorEvent);
      cleanup();
      resetWorker();
      resolve({
        crop: { x: 0, y: 0, width, height },
        confidence: 0,
        subjects: 'AI unavailable',
        skipCrop: true,
      });
    };
    
    currentWorker.addEventListener('message', handleMessage);
    currentWorker.addEventListener('error', handleError);
    
    remoteLogger.info('vision-svc', 'Pre-postMessage', { blobSize: blob?.size ?? -1 });
    
    // Send blob directly - no base64 conversion needed
    // Blobs are structured-cloneable and passed efficiently
    currentWorker.postMessage({
      type: 'detect',
      imageBlob: blob,
      originalWidth: width,
      originalHeight: height,
      isMobile: isMobileDevice(),
    });
  });
}

// ============================================================================
// Batch processing with concurrency control (mobile server path)
// ============================================================================

const MOBILE_CONCURRENCY = 3;

/**
 * Process multiple photos through smart crop with concurrency control.
 * - Mobile (server path): runs up to MOBILE_CONCURRENCY calls in parallel
 * - Desktop (worker path): sequential (single ONNX worker constraint)
 *
 * Calls `onResult` as each photo completes, enabling progressive UI updates.
 */
export async function getSmartCropBatch(
  inputs: SmartCropInput[],
  onResult: (result: SmartCropBatchResult) => void,
  onStatus?: (status: string) => void,
): Promise<void> {
  if (inputs.length === 0) return;

  // Desktop: sequential through the shared worker (can't parallelize ONNX)
  if (!isMobileDevice()) {
    for (const input of inputs) {
      const result = await getSmartCrop(
        input.objectUrl, input.blob, input.width, input.height, onStatus,
      );
      onResult({ id: input.id, ...result });
    }
    return;
  }

  // Mobile: concurrent server calls with semaphore
  remoteLogger.info('batch-crop', 'Starting batch', {
    count: inputs.length,
    concurrency: MOBILE_CONCURRENCY,
  });

  let active = 0;
  let nextIdx = 0;
  const total = inputs.length;

  await new Promise<void>((resolve, reject) => {
    function launch() {
      while (active < MOBILE_CONCURRENCY && nextIdx < total) {
        const input = inputs[nextIdx++];
        active++;

        getServerSmartCrop(input.objectUrl, input.blob, input.width, input.height, onStatus)
          .then(result => {
            onResult({ id: input.id, ...result });
          })
          .catch(error => {
            remoteLogger.error('batch-crop', 'Single photo failed', {
              id: input.id,
              error: error instanceof Error ? error.message : String(error),
            });
            // Fail-forward: return full-image fallback
            onResult({
              id: input.id,
              crop: { x: 0, y: 0, width: input.width, height: input.height },
              confidence: 0,
              subjects: 'Server error',
              skipCrop: true,
            });
          })
          .finally(() => {
            active--;
            if (nextIdx >= total && active === 0) {
              resolve();
            } else {
              launch();
            }
          });
      }
    }

    try {
      launch();
    } catch (e) {
      reject(e);
    }
  });

  remoteLogger.info('batch-crop', 'Batch complete', { count: total });
}

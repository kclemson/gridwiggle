import { CropRegion } from '@/types/collage';
import { remoteLogger } from '@/lib/remoteLogger';
import { isMobileDevice } from '@/lib/platform';

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
      worker = new Worker(
        new URL('../workers/visionWorker.ts', import.meta.url),
        { type: 'module' }
      );
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
  // Mobile skips auto smart-crop entirely — the server (Gemini) path was
  // unreliable (overly aggressive crops). Users adjust manually via the
  // crop editor. Desktop continues to use on-device DETR.
  if (isMobileDevice()) {
    onStatus?.('Skipping auto-crop on mobile');
    return {
      crop: { x: 0, y: 0, width, height },
      confidence: 0,
      subjects: 'Skipped on mobile',
      skipCrop: true,
    };
  }

  // Check worker availability first - fail fast with fallback
  const currentWorker = getWorker();
  
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

/**
 * Process multiple photos through smart crop with concurrency control.
 * - Mobile: skipped entirely — emits a full-image fallback per photo
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

  // Mobile: emit fallback results and return without inference.
  if (isMobileDevice()) {
    for (const input of inputs) {
      onResult({
        id: input.id,
        crop: { x: 0, y: 0, width: input.width, height: input.height },
        confidence: 0,
        subjects: 'Skipped on mobile',
        skipCrop: true,
      });
    }
    return;
  }

  // Desktop: sequential through the shared worker (can't parallelize ONNX)
  for (const input of inputs) {
    const result = await getSmartCrop(
      input.objectUrl, input.blob, input.width, input.height, onStatus,
    );
    onResult({ id: input.id, ...result });
  }
}

import { CropRegion } from '@/types/collage';

interface SmartCropResult {
  crop: CropRegion;
  confidence: number;
  subjects: string;
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
  // Check worker availability first - fail fast with fallback
  const currentWorker = getWorker();
  if (!currentWorker) {
    onStatus?.('Using full image (AI unavailable)');
    return {
      crop: { x: 0, y: 0, width, height },
      confidence: 0,
      subjects: 'AI unavailable'
    };
  }

  return new Promise((resolve, reject) => {
    
    // Timeout after 60 seconds (model download + processing)
    const timeoutId = setTimeout(() => {
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
          subjects: e.data.subjects
        });
      } else if (e.data.type === 'error') {
        cleanup();
        resetWorker();
        reject(new Error(e.data.error));
      } else if (e.data.type === 'status' && onStatus) {
        onStatus(e.data.message);
      }
    };
    
    // Handle worker-level crashes (OOM, uncaught exceptions)
    const handleError = (errorEvent: ErrorEvent) => {
      console.error('Vision worker crashed:', errorEvent);
      cleanup();
      resetWorker();
      reject(new Error('AI processing failed - please try again'));
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
    });
  });
}

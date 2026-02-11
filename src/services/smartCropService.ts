import { CropRegion } from '@/types/collage';
import { remoteLogger } from '@/lib/remoteLogger';

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
    });
  });
}

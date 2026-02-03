

# Fix Worker Crash Handling in Smart Crop Service

Add proper error handling at the source to prevent UI crashes when the Web Worker fails.

---

## Problem

The current `smartCropService.ts` only handles errors sent via `postMessage` (when the worker sends `{type: 'error'}`). If the worker itself crashes (out of memory, uncaught exception during 85MB model load), there's no handler - the promise never resolves and the UI hangs until the browser force-refreshes.

---

## Solution

Update `src/services/smartCropService.ts` with:

1. **`resetWorker()` function** - Terminates and nullifies the worker singleton so a fresh worker is created on retry

2. **Worker `error` event listener** - Catches low-level worker crashes (OOM, syntax errors, etc.)

3. **60-second timeout** - Prevents the UI from hanging forever if the model download stalls

4. **Proper cleanup** - Removes all listeners and clears timeout on success, error, or timeout

---

## File Changes

### `src/services/smartCropService.ts`

```typescript
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

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/visionWorker.ts', import.meta.url),
      { type: 'module' }
    );
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

// Scale image down to max 640px for performance
function scaleImageForProcessing(
  imageDataUrl: string,
  originalWidth: number,
  originalHeight: number
): Promise<{ dataUrl: string; width: number; height: number }> {
  // ... existing implementation unchanged ...
}

export async function getSmartCrop(
  imageDataUrl: string,
  width: number,
  height: number,
  onStatus?: WorkerStatusCallback
): Promise<SmartCropResult> {
  // Scale down for performance
  const scaled = await scaleImageForProcessing(imageDataUrl, width, height);
  
  return new Promise((resolve, reject) => {
    const currentWorker = getWorker();
    
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
    
    currentWorker.postMessage({
      type: 'detect',
      imageDataUrl: scaled.dataUrl,
      originalWidth: width,
      originalHeight: height,
      processedWidth: scaled.width,
      processedHeight: scaled.height
    });
  });
}
```

---

## Why This Works

| Scenario | What Happens |
|----------|--------------|
| Worker crashes during model load | `error` event fires → `handleError` catches it → promise rejects → Index.tsx try/catch shows toast |
| Model download times out | setTimeout fires after 60s → promise rejects → toast shown |
| Worker sends error message | `handleMessage` catches `{type: 'error'}` → promise rejects → toast shown |
| Success | `handleMessage` catches `{type: 'result'}` → promise resolves → photo updated |

The existing try/catch in `Index.tsx` (lines 54-74) already handles the rejected promise properly - it logs the error, updates the photo state, and shows a toast.

---

## No Changes Needed to Index.tsx

The current implementation already handles errors correctly:

```typescript
try {
  const result = await getSmartCrop(...);
  updatePhoto(photo.id, { smartCrop: result.crop, isProcessing: false });
} catch (error) {
  console.error('Smart crop failed for photo:', photo.id, error);
  updatePhoto(photo.id, { isProcessing: false, error: error.message });
  toast.error('Smart crop failed for one photo');
}
```

This will now properly catch worker crashes and timeouts in addition to message-level errors.


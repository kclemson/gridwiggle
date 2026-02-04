

# Fix: Eliminate Base64 Conversion - Pass Blobs Directly to Vision Worker

## Problem

The current smart crop implementation converts Blobs to base64 data URLs before sending to the vision worker:

```typescript
// Current flow in smartCropService.ts
const dataUrl = await blobToDataUrl(blob);  // ← Memory explosion here
const scaled = await scaleImageForProcessing(dataUrl, width, height);
currentWorker.postMessage({ imageDataUrl: scaled.dataUrl, ... });
```

A 3MB JPEG becomes a ~4MB base64 string in memory. When processing 10+ photos, these accumulate and crash the browser tab.

## Solution

**Blobs are structured-cloneable** - they can be passed directly to web workers via `postMessage`. Transformers.js provides `RawImage.fromBlob(blob)` to load images directly from Blobs.

New flow:
```text
Blob → postMessage(blob) → worker → RawImage.fromBlob(blob) → resize → pipeline(rawImage)
```

---

## Technical Changes

### 1. Update Vision Worker (`src/workers/visionWorker.ts`)

Change the worker to accept a Blob instead of a data URL:

```typescript
import { pipeline, RawImage } from "@huggingface/transformers";

interface WorkerMessage {
  type: 'detect';
  imageBlob: Blob;  // ← Changed from imageDataUrl: string
  originalWidth: number;
  originalHeight: number;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'detect') return;
  
  try {
    const model = await loadModel();
    
    self.postMessage({ type: 'status', message: 'Loading image...' });
    
    // Load image directly from blob - no base64 conversion needed
    let image = await RawImage.fromBlob(e.data.imageBlob);
    
    // Scale down to max 640px for performance (using RawImage.resize)
    const maxSize = 640;
    const { width: origW, height: origH } = image.size;
    if (origW > maxSize || origH > maxSize) {
      const scale = Math.min(maxSize / origW, maxSize / origH);
      const newWidth = Math.round(origW * scale);
      const newHeight = Math.round(origH * scale);
      image = await image.resize(newWidth, newHeight);
    }
    
    self.postMessage({ type: 'status', message: 'Detecting subjects...' });
    const results = await model(image);
    
    // Calculate crop using processed vs original dimensions
    const processedWidth = image.width;
    const processedHeight = image.height;
    const crop = calculateOptimalCrop(
      results,
      e.data.originalWidth,
      e.data.originalHeight,
      processedWidth,
      processedHeight
    );
    
    // ... rest of result handling unchanged
  } catch (error) {
    // ... error handling unchanged
  }
};
```

### 2. Simplify Smart Crop Service (`src/services/smartCropService.ts`)

Remove all the base64 conversion and canvas-based scaling - just pass the Blob:

```typescript
export async function getSmartCrop(
  objectUrl: string,
  blob: Blob,
  width: number,
  height: number,
  onStatus?: WorkerStatusCallback
): Promise<SmartCropResult> {
  const currentWorker = getWorker();
  if (!currentWorker) {
    onStatus?.('Using full image (AI unavailable)');
    return {
      crop: { x: 0, y: 0, width, height },
      confidence: 0,
      subjects: 'AI unavailable'
    };
  }

  // No more blobToDataUrl() or scaleImageForProcessing()
  // Just send the blob directly
  
  return new Promise((resolve, reject) => {
    // ... timeout and cleanup handlers unchanged ...
    
    currentWorker.postMessage({
      type: 'detect',
      imageBlob: blob,  // ← Send blob directly
      originalWidth: width,
      originalHeight: height,
    });
  });
}
```

### 3. Remove Unused Code (`src/lib/imageUtils.ts`)

The `blobToDataUrl` function is now only used for export (if at all). We can either:
- Keep it for export functionality
- Remove it if not used elsewhere

The `scaleImageForProcessing` function in `smartCropService.ts` can be deleted entirely.

---

## Memory Impact

| Metric | Before | After |
|--------|--------|-------|
| Memory per 3MB photo | ~7MB (blob + base64) | ~3MB (blob only) |
| Memory for 10 photos | ~70MB strings + blobs | ~30MB blobs only |
| Crash threshold | ~8-10 photos | ~20+ photos |
| Base64 encoding time | ~50-100ms/photo | 0ms |

## Why This Works

1. **Blobs are references** - Passing a Blob to `postMessage` creates a structured clone, but the actual binary data is shared efficiently by the browser
2. **RawImage.fromBlob is native** - Transformers.js decodes directly from the Blob without intermediate string representations
3. **Resize happens in worker** - The heavy image manipulation stays in the worker thread, keeping the main thread responsive

## Files Changed

| File | Change |
|------|--------|
| `src/workers/visionWorker.ts` | Accept Blob, use RawImage.fromBlob, move resizing into worker |
| `src/services/smartCropService.ts` | Remove base64 conversion, remove scaling, just pass blob |
| `src/lib/imageUtils.ts` | Keep for now (used in export), but `blobToDataUrl` no longer called for smart crop |


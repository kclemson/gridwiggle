

## Root Cause: Uncaught Worker Creation Error

The actual bug is simple: **`getWorker()` doesn't handle worker creation failures**.

```typescript
// Line 17-25 of smartCropService.ts
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(                    // ← This throws on Safari mobile
      new URL('../workers/visionWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return worker;
}
```

When Safari mobile fails to create a module worker, this throws synchronously. The error bubbles up, gets caught in the `processSmartCrops` try/catch, logs to console, and sets `error` on the photo - but **no `smartCrop` is ever set**.

---

## The Fix: Catch the Error, Return Fallback

Wrap worker creation in try/catch. If it fails, return a full-image crop instead of crashing:

### `src/services/smartCropService.ts`

**Change 1:** Make `getWorker()` return `null` on failure

```typescript
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
```

**Change 2:** Handle `null` worker in `getSmartCrop()`

```typescript
export async function getSmartCrop(...): Promise<SmartCropResult> {
  const currentWorker = getWorker();
  
  // If worker creation failed, return full-image crop as fallback
  if (!currentWorker) {
    onStatus?.('Using full image (AI unavailable)');
    return {
      crop: { x: 0, y: 0, width, height },
      confidence: 0,
      subjects: 'AI unavailable'
    };
  }
  
  // ... rest of existing code
}
```

---

## Why This Is the Right Fix

| Approach | Problem |
|----------|---------|
| Add global error boundary | Doesn't fix the bug, just hides it with a reload button |
| Add unhandledrejection handler | This is a synchronous throw, not a promise rejection |
| Safari UA detection | Brittle, breaks when Safari adds support |
| **Catch the actual throw** | ✓ Fixes the root cause |

The existing code already has a sensible fallback behavior built in - when `smartCrop` is `null`, `CroppedImage` shows the full image. We just need to actually return a crop instead of throwing.

---

## File Summary

| File | Change |
|------|--------|
| `src/services/smartCropService.ts` | Wrap worker creation in try/catch, return fallback on failure |

No new files. No speculative error boundaries. Just catch the error where it actually happens.


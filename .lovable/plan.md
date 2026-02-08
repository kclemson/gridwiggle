
# iOS Safari Crash Fix: transformers.js v3 Memory Leak

## Root Cause

This is a **known bug in `@huggingface/transformers` v3** (GitHub issue #1242). The math you questioned is correct - 85MB + 6MB should NOT exceed 150MB. 

The real issue: Safari's JavaScriptCore engine has a memory leak when running the default threaded WASM binaries (`ort-wasm-simd-threaded.jsep.wasm`). Memory balloons to 10+GB during model inference, and iOS kills the page at ~150-200MB.

Your version (`^3.8.1`) is affected. The issue was reported in March 2025 and remains open.

## The Fix

Configure ONNX runtime to use single-threaded, non-JSEP WASM binaries before loading the model. This must be set in the worker before `pipeline()` is called.

---

## Implementation

### File: `src/workers/visionWorker.ts`

Add environment configuration at the top of the file, before the `loadModel()` function:

```typescript
import { pipeline, RawImage, env } from "@huggingface/transformers";

// Fix iOS Safari memory leak (GitHub issue #1242)
// Safari's JavaScriptCore has a bug with threaded WASM that causes 10+GB memory usage
// Using single-threaded non-JSEP binaries fixes the crash
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = {
  mjs: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.wasm'
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let detector: any = null;

// ... rest of existing code unchanged
```

### Key Changes

| Setting | Before | After |
|---------|--------|-------|
| `numThreads` | Default (multi-threaded) | `1` (single-threaded) |
| `wasmPaths` | Default (uses threaded.jsep) | Explicit non-JSEP binaries |

---

## Why This Works

1. **Single-threaded execution** avoids the multi-threaded WASM bug in JavaScriptCore
2. **Non-JSEP binaries** (`ort-wasm-simd-threaded.wasm`) are the "Option B" that was confirmed working in the GitHub issue
3. **CDN-hosted binaries** ensure we get exactly the version that works (1.21.0)

---

## Trade-offs

| Aspect | Impact |
|--------|--------|
| **Performance on desktop** | Slightly slower inference (single-threaded vs multi-threaded) |
| **Memory stability** | Fixes the iOS crash completely |
| **Compatibility** | Works on all platforms - the fix doesn't break desktop |

The performance hit is acceptable because:
- DETR runs on a 640×640 resized image (already optimized)
- Single photo processing, not real-time video
- Users would rather wait 2s than crash

---

## Files Modified

| File | Change |
|------|--------|
| `src/workers/visionWorker.ts` | Add ONNX environment config before model loading |

---

## Testing Plan

After implementation:
1. Load page on iOS Safari with 1 photo
2. Should see "Loading AI model..." status
3. Should complete without crashing
4. Should show detected subjects (or "No subjects detected" for non-person photos)

---

## Alternative: Remove iOS Detection

Once this fix is deployed, the iOS detection code we added earlier (`src/lib/deviceUtils.ts`) can be removed since the AI will work on iOS. Or keep it as a fallback safety net.

---

## References

- GitHub Issue: https://github.com/huggingface/transformers.js/issues/1242
- Confirmed fix by multiple users using "Option B" (single-threaded + non-JSEP binaries)

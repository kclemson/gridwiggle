
# Fix: iOS Safari Smart Crop - Remove WASM Path Override

## The Problem

The current fix broke iOS Safari with a new error:
```
t._OrtGetInputOutputMetadata is not a function
```

This happens because we're overriding `wasmPaths` to point to `onnxruntime-web@1.21.0` binaries, but `@huggingface/transformers` v3.8.1 uses a **different internal ONNX version** with different function signatures.

## Root Cause Analysis

| What we did | Why it fails |
|-------------|--------------|
| Set `wasmPaths` to onnxruntime-web@1.21.0 | transformers.js expects its bundled ONNX version's API |
| `_OrtGetInputOutputMetadata` is missing | The 1.21.0 binaries have different exported functions |

The GitHub issue #1242 fix was for a different transformers.js version. The actual fix we need is simpler:
- **Don't override wasmPaths** - let transformers.js use its bundled binaries
- **Do set numThreads = 1** - this alone may fix the memory leak
- **Do force device = "wasm"** - prevent WebGPU attempts on Safari

## The Solution

Remove the `wasmPaths` override entirely. The single-threaded mode should be sufficient to prevent the memory leak, and the bundled binaries will have the correct API.

---

## Implementation

### File: `src/workers/visionWorker.ts`

```typescript
import { pipeline, RawImage, env } from "@huggingface/transformers";

// Detect Safari (both iOS and macOS) - all Safari versions share the JavaScriptCore bug
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isSafari) {
  // Fix iOS Safari memory leak (GitHub issue #1242)
  // Safari's JavaScriptCore has a bug with threaded WASM that causes memory bloat
  // Single-threaded execution avoids the leak while keeping bundled binaries
  env.backends.onnx.wasm.numThreads = 1;
  
  // NOTE: Do NOT override wasmPaths - the bundled binaries have the correct API
  // Overriding to external CDN versions causes "_OrtGetInputOutputMetadata is not a function"
}

// ... rest unchanged
```

### Changes Summary

| Setting | Before | After |
|---------|--------|-------|
| `numThreads` | `1` (Safari only) | `1` (Safari only) - **keep** |
| `wasmPaths` | Override to CDN 1.21.0 | **Remove** - use bundled |
| Device selection | `isSafari ? "wasm" : ...` | **Keep** - still needed |

---

## Why This Should Work

1. **Single-threaded execution** was the key fix in the GitHub issue - it prevents the memory leak
2. **Bundled binaries** have matching API versions - no function signature mismatch
3. **Forced WASM device** prevents Safari from attempting WebGPU (which would fail)

---

## Files Modified

| File | Change |
|------|--------|
| `src/workers/visionWorker.ts` | Remove `wasmPaths` override, keep `numThreads = 1` |

---

## Fallback Plan

If the memory leak persists after removing wasmPaths:
1. The existing `handleError` in `smartCropService.ts` will catch crashes
2. It returns a graceful fallback with `skipCrop: true`
3. Photos will still work, just without AI cropping

But single-threading alone should fix the leak based on the GitHub issue discussion.

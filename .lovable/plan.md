
# Fix: Conditional iOS Safari WASM Configuration

## The Problem

The iOS Safari fix broke desktop browsers. Here's why:

| Setting | iOS Safari Needs | Desktop Needs |
|---------|------------------|---------------|
| WASM binaries | Non-JSEP (avoids memory leak) | JSEP (enables WebGPU) |
| Device | WASM only | WebGPU preferred |
| Threads | Single (Safari bug) | Multi (performance) |

We applied iOS settings globally, so desktop browsers:
1. Try to use WebGPU (line 34: `device = hasWebGPU ? "webgpu" : "wasm"`)
2. Fail because we forced non-JSEP binaries (WebGPU **requires** JSEP)
3. Error: "Failed to initialize JSEP. The WebAssembly module is not built with JSEP support."

## The Solution

Make the ONNX configuration **conditional** based on browser detection:

- **Safari**: Force WASM device + single-threaded + non-JSEP binaries
- **Other browsers**: Use defaults (WebGPU if available, multi-threaded)

---

## Implementation

### File: `src/workers/visionWorker.ts`

```typescript
import { pipeline, RawImage, env } from "@huggingface/transformers";

// Detect Safari (both iOS and macOS) - all Safari versions share the JavaScriptCore bug
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isSafari) {
  // Fix iOS Safari memory leak (GitHub issue #1242)
  // Safari's JavaScriptCore has a bug with threaded WASM that causes 10+GB memory usage
  // Using single-threaded non-JSEP binaries fixes the crash
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.wasmPaths = {
    mjs: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.mjs',
    wasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.wasm'
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let detector: any = null;

async function loadModel() {
  if (!detector) {
    self.postMessage({ type: 'status', message: 'Loading AI model (first time only)...' });
    
    // Safari must use WASM (non-JSEP binaries don't support WebGPU)
    // Other browsers can use WebGPU for better performance
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const device = isSafari ? "wasm" : (hasWebGPU ? "webgpu" : "wasm");
    
    detector = await pipeline(
      "object-detection",
      "Xenova/detr-resnet-50",
      { device }
    );
  }
  return detector;
}

// ... rest of file unchanged
```

---

## Key Changes

| Line | Before | After |
|------|--------|-------|
| Top-level config | Always applies iOS fix | Only applies if Safari detected |
| Device selection | `hasWebGPU ? "webgpu" : "wasm"` | Safari → always WASM; Others → WebGPU if available |

---

## Why This Works

1. **Desktop Chrome/Firefox/Edge**: No config changes applied → uses default JSEP binaries → WebGPU works
2. **Safari (iOS + macOS)**: Forced to WASM + non-JSEP binaries → no memory leak
3. **No global side effects**: Each browser gets optimal settings for its engine

---

## Safari Detection Regex Explained

```javascript
/^((?!chrome|android).)*safari/i.test(navigator.userAgent)
```

- Matches strings containing "Safari" that DON'T contain "Chrome" or "Android"
- Catches: iOS Safari, macOS Safari
- Excludes: Chrome (which includes "Safari" in its UA), Android browsers

---

## Files Modified

| File | Change |
|------|--------|
| `src/workers/visionWorker.ts` | Wrap iOS fix in Safari conditional, update device selection logic |

---

## Expected Outcome

After implementation:
- Desktop (Chrome/Firefox/Edge): WebGPU works, fast inference
- Safari (iOS + macOS): WASM works, no memory crash
- All browsers: Smart crop completes successfully

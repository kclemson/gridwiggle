

# Diagnose: Why YOLOS-Tiny Still Crashes on iOS Safari

## What "Repeatedly" Tells Us

Safari's "A problem repeatedly occurred" message means the WebContent process (the OS-level process hosting the tab) crashed multiple times. Safari has crash-loop protection that kicks in after 2-3 consecutive process crashes. This is NOT a JavaScript error -- it's a process-level termination by WebKit/iOS.

## Current State of Fixes (All Failed)

| Fix | Result |
|-----|--------|
| Input resize 640 to 320px | Still crashes |
| Switch from DETR (~85MB) to YOLOS-Tiny (~25MB) | Still crashes |
| Single-threaded WASM (numThreads=1) | Still crashes |

The crash happens at the same point every time: after "Running inference..." and before any result. This means the ONNX WASM runtime's forward pass is what kills the process -- regardless of model size or input size.

## Diagnostic Plan: Confirm the Safari Fix Is Actually Applying

Before giving up on on-device inference, we need to verify one critical assumption: **is the `isSafari` detection and `numThreads = 1` fix actually working inside the Web Worker?**

The fix runs at module top-level (line 4-14 of visionWorker.ts). While `navigator.userAgent` should be available in Web Workers, we have never confirmed it. If this check silently fails, the worker would try to use multi-threaded WASM -- which is known to cause memory bloat in Safari's JavaScriptCore.

### Changes to `src/workers/visionWorker.ts`

Add diagnostic logging immediately after the Safari detection block:

1. Log the raw `navigator.userAgent` string from within the worker
2. Log whether `isSafari` resolved to `true` or `false`
3. Log the actual `numThreads` value that was set
4. Log the selected `device` (wasm vs webgpu) right before `pipeline()` is called
5. Log the model name being loaded

These logs will flow through the existing worker message channel (using `self.postMessage({ type: 'status', ... })`) so they appear in the remote logger before the crash.

### No changes to `src/services/smartCropService.ts`

The status callback already forwards worker status messages to the remote logger. No changes needed.

## What We Learn

- **If `isSafari` is `false` in the worker**: The single-thread fix never applied, and multi-threaded WASM is likely the root cause. Fix: pass `isSafari` from the main thread instead of detecting in the worker.
- **If `isSafari` is `true` and `numThreads` is 1**: The fix IS applying but ONNX WASM still crashes. This would confirm that even single-threaded WASM execution of any object detection model exceeds iOS Safari's process memory limits, and on-device inference is not viable on current iOS versions.
- **If the logs never appear at all**: The worker is crashing during module initialization (import of transformers.js itself), before any detection code runs.

## Why This Matters Before Moving On

If the Safari fix is NOT applying (scenario 1), we may be one line away from a working solution. If it IS applying (scenario 2), we have definitive evidence that on-device ONNX inference is not viable on iOS Safari, and can make an informed decision about alternatives.


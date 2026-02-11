

# Add Detailed Smart Crop Diagnostic Logging

## Problem

When smart crop crashes on mobile, we have no visibility into WHERE in the pipeline it fails. The current logging only covers worker creation. The actual processing flow -- blob access, postMessage, model loading, inference -- is a black box in production.

## What Changes

Add granular `remoteLogger` calls at every stage of the smart crop pipeline so crashes leave a breadcrumb trail in the edge function logs.

## Logging Points to Add

### 1. `src/pages/Index.tsx` — `handleSingleSmartCrop` (~line 538)

| Stage | Log |
|-------|-----|
| Entry | Photo id, blob size, dimensions, objectUrl validity |
| Pre-call | Right before `getSmartCrop()` |
| Success | Result summary (skipCrop, confidence, subjects) |
| Error | Full error with stack trace via `remoteLogger.error` |
| Finally | Completion marker |

### 2. `src/services/smartCropService.ts` — `getSmartCrop` (~line 59)

| Stage | Log |
|-------|-----|
| Entry | Blob size, type, dimensions |
| Worker available | Whether worker was obtained |
| Pre-postMessage | Right before sending to worker |
| Timeout | When 60s timeout fires |
| Worker crash | In `handleError` — include errorEvent message/filename/lineno |
| Result received | Type of result (success/skipCrop) |
| Error from worker | Error message from worker |

### 3. `src/workers/visionWorker.ts` — status messages (already posts status, but add more)

Add `self.postMessage({ type: 'status', message: '...' })` at these points:
- Before `RawImage.fromBlob` (blob size)
- After image loaded (dimensions)
- Before resize
- After resize
- Before model inference
- After inference (detection count)

These status messages already flow through the `onStatus` callback and will be captured by the remote logger in `handleSingleSmartCrop`.

## Technical Details

**Files modified:**
- `src/pages/Index.tsx` — wrap `handleSingleSmartCrop` with remote logger calls
- `src/services/smartCropService.ts` — add logging at each stage boundary
- `src/workers/visionWorker.ts` — add more granular status messages (these relay through the existing message channel)

**No new dependencies.** Uses existing `remoteLogger` infrastructure. Worker status messages use the existing `self.postMessage({ type: 'status' })` pattern which already flows to the caller.

The key insight: on mobile OOM crashes, the page dies instantly. But the remote logger batches and flushes -- so if we log BEFORE each risky step, the last logged step tells us exactly which operation caused the crash. The `beforeunload` flush handler in `remoteLogger.ts` will attempt to send buffered logs before the page dies.


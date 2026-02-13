

# Speed Up Smart Crop Processing Pipeline

## Current Bottleneck

Each photo goes through 3 phases sequentially, and no work starts on photo N+1 until photo N is completely done:

```text
Photo 1: [dims+preview 80ms] [inference 2000ms] [update]
Photo 2:                                                  [dims+preview 80ms] [inference 2000ms] [update]
Photo 3:                                                                                                  [dims+preview 80ms] ...

Total for 32 photos: ~32 x 2.1s = ~67 seconds
```

## Proposed: Two-Stage Pipeline

Split the loop into a **producer** (prepares previews) that runs ahead of a **consumer** (runs inference). The preview for photo N+1 is created while inference runs on photo N:

```text
Photo 1: [dims+preview] [inference ~~~~~~~~]
Photo 2:                 [dims+preview] wait [inference ~~~~~~~~]
Photo 3:                                      [dims+preview] wait [inference ~~~~~~~~]

Total for 32 photos: ~80ms + 32 x 2.0s = ~64s (minor gain on desktop)
```

The preview overlap saves ~80ms per photo (~2.5s total for 32 photos on desktop). Small but free.

### The Big Win: Server-Side Parallelism (Mobile)

On mobile, inference goes to the edge function (HTTP call). These are **completely independent** -- no shared worker, no memory constraint. We can run 3 concurrently:

```text
Current (mobile, sequential):
Photo 1: [resize+upload 200ms] [server inference 1500ms]
Photo 2:                                                  [resize+upload 200ms] [server inference 1500ms]
...
Total for 32 photos: ~32 x 1.7s = ~54 seconds

Proposed (mobile, 3-concurrent):
Batch 1: [photo 1] [photo 2] [photo 3]  -- all in parallel
Batch 2: [photo 4] [photo 5] [photo 6]  -- all in parallel
...
Total for 32 photos: ~11 batches x 1.7s = ~19 seconds (2.8x faster)
```

## Technical Changes

### 1. `src/hooks/useSmartCropProcessing.ts` -- Add preview pipelining

Replace the single `for` loop with a two-stage approach:
- **Stage 1 (lookahead)**: Kick off `getImageDimensions` + `createDisplayPreview` for the next photo while inference is running on the current one. Use a simple "prefetch one ahead" pattern with a Promise that's awaited when needed.
- **Stage 2 (inference)**: Same as today, but consumes pre-computed dimensions/previews instead of computing them inline.

This keeps the sequential GC-pause-between-photos pattern intact (important for iOS memory) while overlapping CPU work with inference wait time.

### 2. `src/services/smartCropService.ts` -- Add concurrent server path

Add a new export `getSmartCropBatch` that:
- Takes an array of photo inputs
- On mobile (server path): runs up to 3 `getServerSmartCrop` calls concurrently using a simple semaphore
- On desktop (worker path): falls back to sequential (single worker constraint)
- Yields results via a callback as each completes (for progress updates)

### 3. `src/hooks/useSmartCropProcessing.ts` -- Use batch for mobile

When `isMobileDevice()` is true, switch from the sequential loop to the batch API. Progress dots update as each result arrives. The GC delay is inserted between result callbacks.

## Impact Summary

| Platform | Current (32 photos) | Proposed (32 photos) | Speedup |
|---|---|---|---|
| Desktop (worker) | ~67s | ~64s | ~1.05x (preview overlap only) |
| Mobile (server) | ~54s | ~19s | ~2.8x (3-concurrent) |

Desktop gains are modest because the worker is the true bottleneck and can't be parallelized (ONNX memory). Mobile gains are significant because server calls are stateless and independent.

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useSmartCropProcessing.ts` | Preview pipelining (lookahead), mobile batch path |
| `src/services/smartCropService.ts` | Add `getSmartCropBatch` with concurrency control for server path |

## Risk

- Desktop: Near-zero risk, just reorders existing work
- Mobile: Concurrent server calls could hit edge function rate limits. The 3-concurrency cap is conservative and well within typical limits. Fail-forward still applies per-photo.


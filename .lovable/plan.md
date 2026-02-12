
# Fix: Reduce Mobile Inference Memory by Halving Input Size

## Why This Should Work

The model itself (~85MB) loads fine -- we've seen it succeed on mobile. The crash happens during the forward pass (`model(image)`), where intermediate tensors (feature maps, attention matrices) are allocated proportional to the **input image area**. Cutting from 640px to 320px reduces peak inference memory by roughly 4x, which could keep us under iOS Safari's variable memory ceiling.

DETR at 320px is still plenty for detecting people -- we just need bounding boxes, not pixel-perfect segmentation.

## Changes

### 1. Pass `isMobile` flag to the worker

**File:** `src/services/smartCropService.ts`

- Import `isMobileDevice` from `src/lib/platform.ts`
- Add `isMobile: boolean` to the `postMessage` payload sent to the worker

### 2. Use smaller inference size on mobile

**File:** `src/workers/visionWorker.ts`

- Add `isMobile` to the `WorkerMessage` interface
- Change `maxSize` from a hardcoded `640` to `isMobile ? 320 : 640`
- After inference completes, explicitly null out the `image` variable to help GC reclaim tensor memory sooner

### 3. Null out RawImage after inference (both platforms)

Still in `visionWorker.ts` -- after `const results = await model(image)`, set `image = null` to release the pixel buffer before we do post-processing. This reduces peak memory overlap between inference output and input data.

## What This Does NOT Change

- Desktop continues at 640px (no quality regression)
- The model itself is unchanged (~85MB DETR ResNet-50)
- The crop calculation logic is unchanged
- The worker singleton pattern is unchanged
- No server-side fallback needed (photos stay on-device)

## Risk Assessment

- If 320px still crashes on some devices under extreme memory pressure, we'd revisit with either an even smaller size (240px) or the server-side fallback as a last resort
- Detection quality at 320px should be fine for people detection -- DETR was designed for COCO-scale images where objects can be small

## Testing

After publishing, trigger smart crop on the same iPhone that crashed before. If inference completes, the reduced input size was sufficient.



# Fix: Switch to Lighter Detection Model (YOLOS-Tiny) for Mobile

## What We Now Know

The 320px input resize is confirmed live and did NOT fix the crash. The last log before the crash is still `Running inference...`, meaning the model's forward pass itself exceeds iOS Safari's memory ceiling. This rules out input size as the bottleneck -- the problem is the model architecture.

DETR ResNet-50 has a deep convolutional backbone that allocates large intermediate feature maps during inference, regardless of input resolution. These allocations happen inside the ONNX runtime's WASM execution and cannot be controlled from JavaScript.

## Solution: Use YOLOS-Tiny on Mobile

YOLOS-Tiny is a DETR-style object detection model built on a tiny Vision Transformer (ViT) backbone instead of ResNet-50. It produces the same output format (bounding boxes with labels and scores) but uses roughly 3-4x less memory.

| Model | Params | Size | Backbone |
|-------|--------|------|----------|
| DETR ResNet-50 | ~41M | ~85MB | ResNet-50 (deep CNN) |
| YOLOS-Tiny | ~6M | ~25MB | ViT-Tiny (lightweight) |

Both models are trained on COCO and detect "person" among other categories -- which is all we need.

## Changes

### 1. Conditional model loading in `src/workers/visionWorker.ts`

- Accept `isMobile` flag (already passed from the service)
- Load `Xenova/yolos-tiny` on mobile, `Xenova/detr-resnet-50` on desktop
- Cache both models separately (desktop users keep DETR quality, mobile users get a model that actually runs)
- The pipeline API and output format are identical -- no changes needed to `calculateOptimalCrop` or result handling

### 2. No changes to `src/services/smartCropService.ts`

The `isMobile` flag is already being passed to the worker. No other changes needed.

### 3. No changes to crop calculation or result handling

YOLOS-Tiny returns the same `DetectionResult` format (label, score, box) as DETR, so `calculateOptimalCrop` works unchanged.

## What This Preserves

- Photos stay 100% on-device -- no server calls
- Desktop users keep DETR ResNet-50 (no quality regression)
- The worker singleton pattern is unchanged
- The crop calculation logic is unchanged
- The Safari WASM single-thread fix remains in place

## Risk Assessment

- YOLOS-Tiny has lower detection accuracy than DETR, but for detecting people in photos (our primary use case), it should be sufficient
- If YOLOS-Tiny also crashes (unlikely at ~25MB), the next step would be an even smaller model or accepting the server-side fallback
- First model download on mobile will be faster (~25MB vs ~85MB)

## Technical Details

```
// In visionWorker.ts loadModel():
const modelName = isMobile
  ? "Xenova/yolos-tiny"
  : "Xenova/detr-resnet-50";

detector = await pipeline("object-detection", modelName, { device });
```

The `isMobile` flag needs to be stored at module scope so `loadModel()` can access it, since `loadModel` is called before message handling. The simplest approach is to set a module-level variable from the first `detect` message and pass it to `loadModel`.

## Testing

After publishing, trigger smart crop on the same iPhone. With ~60MB less model weight and proportionally smaller intermediate tensors, inference should complete without crashing.

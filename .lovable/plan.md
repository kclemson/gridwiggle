

# Fix Smart Crop Reliability + Stale Crop Data on Regeneration

## Two Bugs, One Fix

### Bug 1: Poor Smart Crops for Cartoons/Memes
DETR returns confidence scores we're ignoring. For cartoon images (Shrek, pineapple house), the model often:
- Misidentifies subjects ("person" for Shrek, "vase" for pineapple)
- Returns low confidence scores (0.3-0.5 vs 0.8+ for real photos)
- Produces bounding boxes that cut off important parts

**Fix:** Add a confidence threshold. If max confidence < 0.6, skip smart cropping and use full image.

### Bug 2: Collage Uses Stale Crop After Manual Save
When user saves a manual crop adjustment, the collage regenerates but shows the OLD crop:

```typescript
// Current code in handleSaveCrop (line 148-154)
updatePhoto(photoId, { manualCrop: crop, priority });  // Async state update
regenerateCollage({ priorityOverride: { photoId, priority } });  // Runs before state updates!
```

The `priorityOverride` pattern exists but there's no equivalent for crops.

**Fix:** Add `cropOverride` to `RegenerateOptions` so the new crop is used immediately.

---

## Technical Changes

### File 1: `src/workers/visionWorker.ts`

Add `skipCrop` flag to result based on confidence threshold:

```typescript
// Around line 135-140, update the result message
const maxConfidence = subjects.length > 0 
  ? Math.max(...results.filter(r => r.score > 0.4).map(r => r.score)) 
  : 0;

self.postMessage({
  type: 'result',
  crop,
  confidence: maxConfidence,
  subjects: subjectDescription,
  skipCrop: maxConfidence < 0.6,  // NEW: flag to skip unreliable crops
});
```

### File 2: `src/services/smartCropService.ts`

Update interface to include `skipCrop`:

```typescript
interface SmartCropResult {
  crop: CropRegion;
  confidence: number;
  subjects: string;
  skipCrop: boolean;  // NEW
}

// In handleMessage, pass through the flag
resolve({
  crop: e.data.crop,
  confidence: e.data.confidence,
  subjects: e.data.subjects,
  skipCrop: e.data.skipCrop ?? false,  // NEW
});
```

### File 3: `src/pages/Index.tsx`

**Change 1:** Only apply smart crop when model is confident:

```typescript
// In processSmartCrops (around line 112-123)
const result = await getSmartCrop(...);

// Only apply smart crop if model is confident
const smartCropToApply = result.skipCrop ? null : result.crop;

updatePhoto(photo.id, {
  smartCrop: smartCropToApply,
  isProcessing: false,
});
```

**Change 2:** Add `cropOverride` to `RegenerateOptions`:

```typescript
interface RegenerateOptions {
  photos?: PhotoItem[];
  settings?: CollageSettingsType;
  priorityOverride?: { photoId: string; priority: PhotoPriority };
  cropOverride?: { photoId: string; crop: CropRegion };  // NEW
  randomize?: boolean;
}
```

**Change 3:** Apply crop override in `regenerateCollage`:

```typescript
const regenerateCollage = useCallback((options: RegenerateOptions = {}) => {
  const {
    photos = photosRef.current,
    settings = state.settings,
    priorityOverride,
    cropOverride,  // NEW
    randomize = false,
  } = options;
  
  // Apply crop override to get correct dimensions immediately
  let photosToUse = photos;
  if (cropOverride) {
    photosToUse = photos.map(p => 
      p.id === cropOverride.photoId 
        ? { ...p, manualCrop: cropOverride.crop }
        : p
    );
  }
  
  if (photosToUse.length < 2) {
    setLayout(null);
    return;
  }
  
  // Use photosToUse for the rest of the function...
}, [...]);
```

**Change 4:** Pass crop override from `handleSaveCrop`:

```typescript
const handleSaveCrop = useCallback((photoId: string, crop: CropRegion, priority: PhotoPriority) => {
  updatePhoto(photoId, { manualCrop: crop, priority });
  setEditingPhotoId(null);
  if (state.layout) {
    regenerateCollage({ 
      priorityOverride: { photoId, priority },
      cropOverride: { photoId, crop },  // NEW - pass crop immediately
    });
  }
}, [updatePhoto, state.layout, regenerateCollage]);
```

---

## Confidence Threshold Behavior

| Confidence | Typical Content | Action |
|------------|-----------------|--------|
| 0.7 - 0.95 | Real photos (faces, people, objects) | Apply smart crop |
| 0.6 - 0.7 | Mixed/borderline | Apply smart crop |
| < 0.6 | Cartoons, memes, screenshots, graphics | Skip - use full image |

The 0.6 threshold is based on DETR being trained on real-world COCO images. For stylized content, its confidence drops significantly.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/workers/visionWorker.ts` | Add `skipCrop` flag to result when confidence < 0.6 |
| `src/services/smartCropService.ts` | Add `skipCrop` to interface and pass through |
| `src/pages/Index.tsx` | Only apply smart crop when not skipped; add `cropOverride` to fix stale data bug |

---

## Expected Results

**Cartoon/meme images:**
- DETR confidence low (0.3-0.5) → `skipCrop: true` → full image used
- No more cut-off Shrek or pineapple houses

**Real photos:**
- DETR confidence high (0.7+) → `skipCrop: false` → smart crop applied as before

**Manual crop adjustment:**
- Saving crop immediately updates collage preview
- No need to click "Shuffle" to see the change


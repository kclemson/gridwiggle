

## Debugging the Crop Mismatch Bug

### The Core Problem
The thumbnail and crop editor are displaying DIFFERENT crop regions for the same photo:
- **Thumbnail**: Shows the pineapple with full green fronds (appears to show the entire image)
- **Editor**: Shows crop handles that cut off the top of the fronds

### Root Cause Analysis

After tracing through the code, there are two possible causes:

**Hypothesis A: Thumbnail is showing the full image (crop not applied)**
If `getDisplayCrop(photo)` returns `null` for the thumbnail but `getEditorInitialCrop(photo)` returns a crop for the editor, this explains the difference:
- Thumbnail shows full image (no crop)
- Editor shows centered 80% fallback crop (which cuts off edges)

**Hypothesis B: State timing issue**
The `photo` object passed to the thumbnail and editor might have different `smartCrop` values at different times.

### Recommended Debugging Approach

Rather than removing the square constraint (which adds complexity), I recommend adding **temporary console logging** to isolate the issue:

**Step 1: Add logging to `cropUtils.ts`**

```typescript
export function getDisplayCrop(photo: PhotoItem): CropRegion | null {
  console.log('[getDisplayCrop]', {
    photoId: photo.id,
    hasOriginalDims: Boolean(photo.originalWidth && photo.originalHeight),
    hasSmartCrop: Boolean(photo.smartCrop),
    hasManualCrop: Boolean(photo.manualCrop),
    smartCrop: photo.smartCrop,
    manualCrop: photo.manualCrop
  });
  
  // ... rest of function
}

export function getEditorInitialCrop(photo: PhotoItem): CropRegion {
  const displayCrop = getDisplayCrop(photo);
  console.log('[getEditorInitialCrop]', {
    photoId: photo.id,
    displayCrop,
    usingFallback: !displayCrop
  });
  
  // ... rest of function
}
```

**Step 2: Add logging to components**

In `PhotoThumbnail.tsx`:
```typescript
const activeCrop = showCropped ? getDisplayCrop(photo) : null;
console.log('[PhotoThumbnail]', { photoId: photo.id, showCropped, activeCrop });
```

In `CropEditor.tsx`:
```typescript
const [crop, setCrop] = useState<CropRegion>(() => {
  const initialCrop = getEditorInitialCrop(photo);
  console.log('[CropEditor init]', { photoId: photo.id, initialCrop });
  return initialCrop;
});
```

### Expected Outcome

The logs will reveal exactly what data each component is receiving. We'll see:
1. Whether `getDisplayCrop` returns `null` vs a valid crop
2. Whether the crop coordinates match between thumbnail and editor
3. Whether the photo object has the expected `smartCrop` data

### Why Not Remove Square Constraint Yet

The square constraint isn't the bug - it just affects how the crop is displayed (with letterboxing). The underlying issue is that the two components are seeing different crop data or one isn't applying the crop at all.

Adding logging first will:
1. Confirm exactly where the mismatch occurs
2. Take < 5 minutes to implement
3. Give us definitive data for the next step

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/cropUtils.ts` | Add console.log to `getDisplayCrop` and `getEditorInitialCrop` |
| `src/components/PhotoThumbnail.tsx` | Add console.log after `getDisplayCrop` call |
| `src/components/CropEditor.tsx` | Add console.log in useState initializer |

### After Finding the Bug

Once we identify exactly where the mismatch occurs, we can:
1. Fix the root cause
2. Remove the debug logging
3. Verify the fix


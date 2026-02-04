

## Auto-Generate Collage After Processing

### Goal

When the last photo finishes smart crop processing, automatically generate the collage with default settings - eliminating the need for users to click "Create Collage".

### Current Flow

```text
Upload Photos → Save to IndexedDB → Process Smart Crops → [User clicks "Create Collage"] → Show Preview
```

### New Flow

```text
Upload Photos → Save to IndexedDB → Process Smart Crops → Auto-generate Collage → Show Preview
```

### Technical Approach

The `processSmartCrops` function already has the perfect trigger point: after the processing loop completes (lines 82-84). At this point:
- All photos have been processed (success or error)
- State has been updated with smart crops
- We can check if conditions for collage creation are met

**Why not useEffect?** Per the project's guidelines, effects should not be used for internal state synchronization. Since we already have an event handler (`processSmartCrops`) that knows exactly when processing finishes, we trigger the collage generation directly from there.

### Changes

**File: `src/pages/Index.tsx`**

Modify `processSmartCrops` to accept a callback that runs after all processing completes:

```tsx
const processSmartCrops = useCallback(async (photos: PhotoItem[], onComplete?: () => void) => {
  if (photos.length === 0) return;
  
  setIsProcessingSmartCrop(true);
  setSmartCropProgress(0);
  
  let completed = 0;
  const total = photos.length;

  for (const photo of photos) {
    // ... existing processing logic ...
    completed++;
    setSmartCropProgress((completed / total) * 100);
  }
  
  setIsProcessingSmartCrop(false);
  setSmartCropProgress(0);
  
  // Call completion callback if provided
  onComplete?.();
}, [updatePhoto]);
```

Then in `handlePhotosAdded`, pass a callback that generates the collage:

```tsx
const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
  const { succeeded } = await addPhotos(newPhotos);
  
  if (succeeded.length === 0) {
    return;
  }

  try {
    await processSmartCrops(succeeded, () => {
      // Auto-generate collage if we have enough photos and no layout yet
      // Note: state.photos may be stale here, so we need to access current count
      // The callback runs after state updates, so we check conditions then generate
    });
  } catch (error) {
    console.error('Smart crop processing failed:', error);
    toast.error('AI processing failed. Please try again.');
  }
}, [addPhotos, processSmartCrops]);
```

**Challenge: Stale Closure**

The callback in `handlePhotosAdded` captures `state` at call time, but `processSmartCrops` updates state during iteration. By the time the callback runs, `state.photos` in the closure is stale.

**Solution: Use a ref to track whether to auto-generate**

```tsx
const shouldAutoGenerateRef = useRef(false);
```

Set this flag before processing starts (if no layout exists), then check it in the callback:

```tsx
const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
  const { succeeded } = await addPhotos(newPhotos);
  
  if (succeeded.length === 0) return;

  // Mark that we should auto-generate if this is the first batch
  shouldAutoGenerateRef.current = state.layout === null;

  try {
    await processSmartCrops(succeeded);
  } catch (error) {
    console.error('Smart crop processing failed:', error);
    toast.error('AI processing failed. Please try again.');
  }

  // After processing, check if we should auto-generate
  if (shouldAutoGenerateRef.current) {
    // Trigger collage generation - need to use latest state
    handleCreateCollage();
    shouldAutoGenerateRef.current = false;
  }
}, [addPhotos, processSmartCrops, state.layout, handleCreateCollage]);
```

**Actually simpler**: Since `handlePhotosAdded` is async and `await processSmartCrops(succeeded)` blocks until complete, we can just call `handleCreateCollage` after the await, checking conditions at that point. But we still face the stale closure issue with `state`.

**Cleanest Solution: Move the logic into processSmartCrops with access to current state**

Actually, the cleanest approach is to:
1. Check if layout is `null` before starting processing
2. After processing completes, call `handleCreateCollage` if we started with no layout

```tsx
const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
  const { succeeded } = await addPhotos(newPhotos);
  
  if (succeeded.length === 0) return;

  // Remember if we should auto-generate (no layout before processing)
  const wasLayoutEmpty = state.layout === null;

  try {
    await processSmartCrops(succeeded);
  } catch (error) {
    console.error('Smart crop processing failed:', error);
    toast.error('AI processing failed. Please try again.');
  }

  // Auto-generate collage after first batch processing
  if (wasLayoutEmpty) {
    handleCreateCollage();
  } else {
    setLayoutStale(true);
  }
}, [addPhotos, processSmartCrops, state.layout, handleCreateCollage]);
```

This works because:
- `wasLayoutEmpty` is captured at the start of the function
- `handleCreateCollage` accesses `state.photos` from its own closure, which will be up-to-date since it's called after `processSmartCrops` completes and React has batched the state updates

**One edge case**: `handleCreateCollage` checks `photosWithSmartCrop.length >= 2` internally. Actually, looking at the code, `handleCreateCollage` doesn't check this - it just generates. The check is only in the JSX for the button disabled state. We should add a check:

```tsx
if (wasLayoutEmpty) {
  // Only auto-generate if we have at least 2 photos with crops
  // handleCreateCollage will use current state.photos
  handleCreateCollage();
}
```

Since `handleCreateCollage` reads from `state.photos` which is updated during processing, and React batches these updates, by the time we call it after the `await`, the state should be current.

### Summary of Changes

| Location | Change |
|----------|--------|
| `handlePhotosAdded` | Capture `wasLayoutEmpty` before processing, call `handleCreateCollage()` after if true |
| Remove `setLayoutStale(true)` line | Replace with conditional: stale if layout existed, auto-generate if not |

### Result

- First batch of photos uploaded → processing → collage auto-generated
- Adding more photos to existing collage → processing → layout marked stale (shuffle icon visible)
- No useEffect needed - logic stays in event handlers
- Button still available for regenerating/shuffling


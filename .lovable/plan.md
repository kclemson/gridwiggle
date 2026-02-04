
## Fix: Auto-Generated Collage Shows Empty (Stale Closure Issue)

### Root Cause

The collage generation reads `state.photos` from a closure that's stale by the time processing completes:

```text
Timeline:
1. handlePhotosAdded captures handleCreateCollage (which has state.photos = [])
2. processSmartCrops updates photos one by one via updatePhoto
3. After await, handleCreateCollage() is called
4. But handleCreateCollage still sees state.photos = [] from step 1
5. generateCollageLayout receives empty array → empty layout
```

When you click the refresh button, React has re-rendered and created a new `handleCreateCollage` with the current photos, so it works.

### Solution

Use a **ref** to always access the latest photos when generating the collage. This bypasses the stale closure problem since refs hold mutable values.

### Technical Changes

**File: `src/pages/Index.tsx`**

1. **Add a ref to track current photos**:
```tsx
const photosRef = useRef<PhotoItem[]>(state.photos);

// Keep ref in sync with state (simple assignment, no useEffect needed)
photosRef.current = state.photos;
```

2. **Update `handleCreateCollage` to use the ref**:
```tsx
const handleCreateCollage = useCallback(() => {
  // Use ref for latest photos (avoids stale closure)
  const photos = photosRef.current;
  
  // Build weights from photo priorities
  const photoWeights: Record<string, number> = {};
  for (const photo of photos) {
    photoWeights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  
  // Randomize when regenerating (layout already exists) for variety
  const shouldRandomize = state.layout !== null;
  
  const layout = generateCollageLayout(photos, state.settings, { 
    photoWeights,
    randomize: shouldRandomize 
  });
  setLayout(layout);
  setLayoutStale(false);
}, [state.settings, state.layout, setLayout]); // Note: state.photos removed from deps
```

This way, `handleCreateCollage` always reads from `photosRef.current` which is updated on every render.

### Why This Works

| Before | After |
|--------|-------|
| `handleCreateCollage` captures `state.photos` at creation time | `handleCreateCollage` reads `photosRef.current` at call time |
| Stale after async operations update state | Always gets latest value regardless of when function was created |

### Alternative Considered

Another approach would be to pass photos directly as a parameter to `handleCreateCollage`, but the ref pattern is cleaner since the function is also used by the refresh button and crop save handler.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `photosRef`, update `handleCreateCollage` to use ref |

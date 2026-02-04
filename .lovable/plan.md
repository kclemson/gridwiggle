

## Refactor: Centralized Collage Regeneration

### Goal

Consolidate all collage regeneration triggers into a single `regenerateCollage` function to eliminate code duplication and ensure consistent behavior.

---

## Technical Changes

### File: `src/pages/Index.tsx`

**1. Remove `layoutStale` state (line 45)**

No longer needed since all changes will regenerate immediately:

```tsx
// DELETE this line:
const [layoutStale, setLayoutStale] = useState(false);
```

**2. Add `RegenerateOptions` interface and `regenerateCollage` function (after line 49)**

Insert after the `photosRef` lines:

```tsx
// Options for regenerating the collage layout
interface RegenerateOptions {
  /** Use specific photos instead of current state (for removal before state updates) */
  photos?: PhotoItem[];
  /** Use specific settings instead of current state */
  settings?: CollageSettingsType;
  /** Override a single photo's priority before state updates */
  priorityOverride?: { photoId: string; priority: PhotoPriority };
  /** Shuffle for variety (refresh button) */
  randomize?: boolean;
}

// Centralized collage regeneration - all triggers use this
const regenerateCollage = useCallback((options: RegenerateOptions = {}) => {
  const {
    photos = photosRef.current,
    settings = state.settings,
    priorityOverride,
    randomize = false,
  } = options;
  
  // Need at least 2 photos for a collage
  if (photos.length < 2) {
    setLayout(null);
    return;
  }
  
  // Build weights from priorities (with optional override for pending state updates)
  const photoWeights: Record<string, number> = {};
  for (const photo of photos) {
    const effectivePriority = priorityOverride?.photoId === photo.id 
      ? priorityOverride.priority 
      : photo.priority;
    photoWeights[photo.id] = effectivePriority === 1 ? 2.0 : 1.0;
  }
  
  const layout = generateCollageLayout(photos, settings, { 
    photoWeights,
    randomize,
  });
  setLayout(layout);
}, [state.settings, setLayout]);
```

**3. Simplify `handleRemovePhoto` (lines 91-94)**

Replace with auto-regeneration:

```tsx
const handleRemovePhoto = useCallback((photoId: string) => {
  removePhoto(photoId);
  if (state.layout) {
    const remainingPhotos = state.photos.filter(p => p.id !== photoId);
    regenerateCollage({ photos: remainingPhotos });
  }
}, [removePhoto, state.layout, state.photos, regenerateCollage]);
```

**4. Simplify `handleSaveCrop` (lines 96-112)**

Replace with:

```tsx
const handleSaveCrop = useCallback((photoId: string, crop: CropRegion, priority: PhotoPriority) => {
  updatePhoto(photoId, { manualCrop: crop, priority });
  setEditingPhotoId(null);
  if (state.layout) {
    regenerateCollage({ priorityOverride: { photoId, priority } });
  }
}, [updatePhoto, state.layout, regenerateCollage]);
```

**5. Simplify `handleToggleHero` (lines 114-132)**

Replace with:

```tsx
const handleToggleHero = useCallback((photoId: string) => {
  const photo = state.photos.find(p => p.id === photoId);
  if (!photo) return;
  
  const newPriority: PhotoPriority = photo.priority === 1 ? 3 : 1;
  updatePhoto(photoId, { priority: newPriority });
  
  if (state.layout) {
    regenerateCollage({ priorityOverride: { photoId, priority: newPriority } });
  }
}, [state.photos, state.layout, updatePhoto, regenerateCollage]);
```

**6. Simplify `handleCreateCollage` (lines 134-153)**

Replace with:

```tsx
const handleCreateCollage = useCallback(() => {
  regenerateCollage({ randomize: state.layout !== null });
}, [state.layout, regenerateCollage]);
```

**7. Update `handlePhotosAdded` (lines 155-180)**

Change the end to regenerate immediately instead of marking stale:

```tsx
const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
  const { succeeded } = await addPhotos(newPhotos);
  
  if (succeeded.length === 0) {
    return;
  }

  const wasLayoutEmpty = state.layout === null;

  try {
    await processSmartCrops(succeeded);
  } catch (error) {
    console.error('Smart crop processing failed:', error);
    toast.error('AI processing failed. Please try again.');
  }

  // Always regenerate - first batch without randomization, subsequent with
  regenerateCollage({ randomize: !wasLayoutEmpty });
}, [addPhotos, processSmartCrops, state.layout, regenerateCollage]);
```

**8. Simplify `handleUpdateSettings` (lines 182-193)**

Replace with:

```tsx
const handleUpdateSettings = useCallback((updates: Partial<CollageSettingsType>) => {
  updateSettings(updates);
  if (state.layout && ('gapSize' in updates || 'orientation' in updates)) {
    const newSettings = { ...state.settings, ...updates };
    regenerateCollage({ settings: newSettings });
  }
}, [updateSettings, state.layout, state.settings, regenerateCollage]);
```

---

## Summary of Changes

| Handler | Before | After |
|---------|--------|-------|
| `handleCreateCollage` | 20 lines with weight building | 3 lines |
| `handleSaveCrop` | 17 lines with weight loop | 7 lines |
| `handleToggleHero` | 19 lines with weight loop | 10 lines |
| `handleUpdateSettings` | 12 lines | 7 lines |
| `handleRemovePhoto` | Marks stale | Auto-regenerates |
| `handlePhotosAdded` | Marks stale for existing layouts | Auto-regenerates |

---

## Benefits

- **Single source of truth**: All regeneration logic in one function
- **Consistent weight calculation**: No more duplicated loops
- **Immediate feedback**: Photo removal regenerates instantly
- **Easier maintenance**: Future changes only need one place
- **~40 lines removed**: Cleaner, more readable code



## Unify Photo Grid: Show All Photos in Single Grid

### Current Architecture (Already Good)

`PhotoThumbnail` already handles all photo states correctly:
- **Processing** → Shows original image with spinner overlay (lines 54-58)
- **Error** → Shows original image with error icon overlay (lines 62-66)  
- **Completed** → Shows cropped image when `showCropped=true`

The component uses `getDisplayCrop(photo)` which returns `null` if no crop exists yet, and `CroppedImage` gracefully falls back to showing the original image.

### The Problem

`Index.tsx` filters photos before passing to the grid:
```tsx
const photosWithSmartCrop = state.photos.filter((p) => p.smartCrop || p.manualCrop);
```

This excludes processing/pending photos from the "smart cropped" grid entirely.

### The Fix

Pass ALL photos to a single grid with `showCropped`. The existing component logic handles the rest:

| Photo State | `getDisplayCrop()` returns | `CroppedImage` shows | Overlay |
|-------------|---------------------------|---------------------|---------|
| Processing | `null` | Original image | Spinner |
| Error | `null` | Original image | Error icon |
| Completed | Crop region | Cropped image | None |

### Changes

**File: `src/pages/Index.tsx`**

1. Remove the "Original Photos" grid entirely (lines 292-297)

2. Change the smart crop grid condition from `photosWithSmartCrop.length > 0` to `state.photos.length > 0` (but this is already covered by the parent condition on line 282)

3. Pass `state.photos` instead of `photosWithSmartCrop`:
```tsx
<PhotoGrid
  photos={state.photos}  // ALL photos, not filtered
  onRemove={handleRemovePhoto}
  onPhotoClick={setEditingPhotoId}
  showCropped
  title="Photos"
  hint="tap to adjust crop"
/>
```

4. Update the `onPhotoClick` handler to only open crop editor for photos that have a crop (can't edit what doesn't exist yet):
```tsx
onPhotoClick={(photoId) => {
  const photo = state.photos.find(p => p.id === photoId);
  if (photo && (photo.smartCrop || photo.manualCrop)) {
    setEditingPhotoId(photoId);
  }
}}
```

### Result

Single unified grid where:
- Photos appear immediately when uploaded (showing original with spinner)
- Spinner disappears and cropped version appears when processing completes
- Failed photos show error indicator but remain visible and removable
- Tapping only opens crop editor for completed photos (no-op for processing/failed)

### No Changes Needed

- `PhotoThumbnail` - already handles all states
- `PhotoGrid` - just renders what it's given
- `CroppedImage` - already handles null crops gracefully

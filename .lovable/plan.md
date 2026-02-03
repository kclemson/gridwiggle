
# Fix: Smart Cropped Thumbnail Grid Not Updating After Crop Save

## Root Cause Analysis

After tracing through the code path when the user saves a crop:

1. `CropEditor.handleSave()` calls `onSave(photo.id, crop)`
2. `Index.handleSaveCrop()` calls `updatePhoto(photoId, { manualCrop: crop })`
3. `useCollageState.updatePhoto()` updates state with new photos array
4. React should re-render `PhotoGrid` with new photos
5. `PhotoThumbnail` should receive updated `photo` prop
6. `CroppedImage` should render with new `crop` values

**The Problem**: While React does re-render the components, `CroppedImage` doesn't receive a `key` prop at the component level. The `key` is only used internally on the `<img>` element. React may be reusing the `CroppedImage` component instance and only updating props, but the browser isn't visually reflecting the style changes correctly.

Additionally, `CollagePreview` has the same issue - it renders `CroppedImage` without a key that changes when crops change.

## Solution

Add a `key` prop to the `CroppedImage` component calls in both `PhotoThumbnail` and `CollagePreview` that changes when the crop changes. This forces React to treat it as a completely new component, ensuring the DOM is fully recreated.

---

## Technical Details

### File 1: `src/components/PhotoThumbnail.tsx`

Generate a crop-based key and pass it to `CroppedImage`:

```typescript
// Generate a key that changes when crop changes
const cropKey = activeCrop 
  ? `${activeCrop.x}-${activeCrop.y}-${activeCrop.width}-${activeCrop.height}`
  : 'no-crop';

// In JSX:
<CroppedImage
  key={cropKey}  // Forces remount when crop changes
  src={photo.objectUrl}
  crop={showCropped ? activeCrop : null}
  originalWidth={photo.originalWidth}
  originalHeight={photo.originalHeight}
  fit={fitMode}
/>
```

### File 2: `src/components/CollagePreview.tsx`

Same pattern - generate a key from the active crop for each cell:

```typescript
// Inside the layout.cells.map:
const crop = getActiveCrop(photo);
const cropKey = crop 
  ? `${crop.x}-${crop.y}-${crop.width}-${crop.height}`
  : 'no-crop';

// In JSX:
<CroppedImage
  key={cropKey}
  src={photo.objectUrl}
  crop={crop}
  originalWidth={photo.originalWidth}
  originalHeight={photo.originalHeight}
  fit="cover"
/>
```

---

## Why This Works

React uses `key` props to determine component identity. When a key changes:
1. React unmounts the old component instance
2. React mounts a new component instance with fresh state and DOM elements
3. The browser creates a completely new `<img>` element with the new styles

Without a key at the component level, React tries to update the existing component by passing new props. While this should work in theory, browsers can sometimes cache layout calculations or exhibit quirks with absolutely positioned elements and transforms. The key-based approach is more robust.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/PhotoThumbnail.tsx` | Add crop-based `key` to `CroppedImage` |
| `src/components/CollagePreview.tsx` | Add crop-based `key` to `CroppedImage` |



# Fix: Mobile Collage Shows Black Box After Upload

## What's Happening

Photos upload and smart-crop fine on mobile, but the collage renders as a blank black box. This is because the layout engine receives photos with 0x0 dimensions and filters them all out.

## Why Only Mobile

Desktop's AI worker is slow (seconds per photo), giving React time to apply dimension updates before layout runs. Mobile's server crop is fast (sub-second), so the layout reads stale 0x0 dimensions.

## The Fix (two small edits in `src/pages/Index.tsx`)

### Edit 1: Return dimensions from `processSmartCrops`

The function already loads dimensions (line 310-312) and calls `updatePhoto` with them. We just need to also **return** them so the caller can use them immediately.

- Add a `results` array that collects `{ id, width, height }` for each processed photo
- Return it at the end of the function

### Edit 2: Use returned dimensions in `handlePhotosAdded`

After `await processSmartCrops(succeeded)` returns the dimension list, merge them onto `photosRef.current` to create a `patchedPhotos` array, then pass it directly:

```
regenerateCollage({ photos: patchedPhotos, randomize: !wasLayoutEmpty })
```

This bypasses the stale ref for this one call. Everything else (crop editor, settings changes, manual regenerate) continues using the ref as before.

## What Does NOT Change

- Layout engine, scoring, strategies -- untouched
- Smart crop service (desktop or server) -- untouched
- State management, IndexedDB, recovery -- untouched
- Desktop behavior -- identical (just gets the same safeguard)


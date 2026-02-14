

# Show Smart-Cropped Thumbnails in Photo Strip

## What changes for the user

The photo strip filmstrip will show the cropped version of each photo (matching what appears in the collage) instead of the raw uncropped original. This gives an immediate visual cue that smart cropping happened, reinforcing the "N auto-cropped" label.

## Technical approach

### `src/components/PhotoStrip.tsx`

Replace the plain `<img>` tag with the existing `CroppedImage` component, using `getDisplayCrop` to get the active crop region (same pattern used by `ThumbnailNavigator` and `CollagePreview`).

Since the strip has a fixed height (56px) and images flow horizontally, each photo needs a wrapper sized to the crop's aspect ratio:

```text
For each photo:
  crop = getDisplayCrop(photo)
  aspectRatio = crop ? (crop.width / crop.height) : (originalWidth / originalHeight)
  wrapper width = strip height (56px) * aspectRatio
```

The wrapper gets `overflow-hidden` and `CroppedImage` renders inside it with `fit="cover"`.

For photos without dimensions yet (still loading), fall back to the current plain `<img>` behavior.

### No other files change

`CroppedImage` and `getDisplayCrop` already exist and are battle-tested across the app. No new utilities needed.

### Edge cases

- Photos with no crop (landscape/object shots where smart crop was skipped): render uncropped, same as today
- Photos still processing: `originalWidth` may be 0; fall back to plain `<img>` with `object-cover`
- Manual crops: also shown, since `getDisplayCrop` respects the manual-overrides-smart precedence




# Show Crop Boundaries in Thumbnail Navigator

## Problem

Right now, each thumbnail in the "Adjust Crops" gallery shows only the cropped portion of the photo. Users can't see what the smart crop actually did -- they'd have to tap into the editor to discover it. This is especially important on mobile where smart crop doesn't run automatically on upload.

## User Outcome

Every thumbnail shows the **full original image** with the crop region highlighted -- bright inside the crop, dimmed outside (just like the crop editor). Users can instantly see:
- What part of the photo the AI chose to keep
- How much of the original image is being cropped away
- Which photos have no crop applied (shown fully bright, no overlay)

```text
Current:                        New:
+----------+                    +----------------+
|  cropped |                    |░░░░░░░░░░░░░░░░|
|  portion |                    |░░+----------+░░|
|  only    |                    |░░| bright   |░░|
+----------+                    |░░| crop     |░░|
                                |░░+----------+░░|
                                |░░░░░░░░░░░░░░░░|
                                +----------------+
                                (░ = dimmed area)
```

## Technical Details

**File:** `src/components/ThumbnailNavigator.tsx`

### Change 1: Thumbnail width uses full-image aspect ratio

Currently the aspect ratio switches between crop and original. Change to always use original:

```typescript
// Before
const aspectRatio = crop 
  ? crop.width / crop.height 
  : photo.originalWidth / photo.originalHeight || 1;

// After
const aspectRatio = photo.originalWidth / photo.originalHeight || 1;
```

### Change 2: Replace CroppedImage with full image + crop overlay

Replace the `CroppedImage` / `img` conditional block with:

1. Always render the full image using a simple `img` tag (still using `photo.thumbnailUrl ?? photo.previewUrl ?? photo.objectUrl` -- the smallest available preview, not the full-res file)
2. When a crop exists, render 4 absolutely-positioned semi-transparent divs covering the regions outside the crop:

```typescript
const topPct = (crop.y / photo.originalHeight) * 100;
const leftPct = (crop.x / photo.originalWidth) * 100;
const widthPct = (crop.width / photo.originalWidth) * 100;
const heightPct = (crop.height / photo.originalHeight) * 100;
```

These percentages position 4 overlay divs (top strip, bottom strip, left strip, right strip) to darken everything outside the crop region.

3. Add a thin white/semi-transparent border around the crop region for clarity at small sizes.

### Change 3: Remove the crop icon badge

Remove the small crop icon badge (lines 169-174) since the visual overlay now communicates the same information more effectively.

### Change 4: Remove CroppedImage import

The `CroppedImage` import can be removed from this file since we no longer use it here (it's still used elsewhere in the app).

### Summary

- 1 file changed: `src/components/ThumbnailNavigator.tsx`
- No new components or files needed
- All existing functionality preserved (hero badge, index number, progressive loading, smart crop/undo buttons)


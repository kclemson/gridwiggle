

# Performance Optimization: CSS-Based Image Rendering

## Overview

Replace SVG-based image cropping with CSS-based cropping using native `<img>` elements. This leverages hardware-accelerated image decoding and GPU compositing, significantly improving rendering performance when working with multiple photos.

---

## Design Intent

**Problem**: The current SVG `viewBox` approach forces the browser to:
1. Load the full-resolution image into an `<image>` element
2. Rasterize through SVG rendering pipeline
3. Clip to the viewBox region

With 15-20 photos, this creates noticeable lag during drag operations and initial render.

**Solution**: Use CSS-based cropping with `overflow: hidden` and CSS transforms. The browser's native image pipeline is highly optimized and uses hardware acceleration.

**User Outcome**: Smoother interactions, faster initial render, no visible difference in the final output.

---

## Technical Approach

### CSS Cropping Math

The key insight: we can achieve identical visual results by:
1. Wrapping the image in a container sized to the **crop region's aspect ratio**
2. Scaling the image so the crop region fills the container
3. Translating the image to position the crop region at origin

```text
Container: sized by parent (fill mode)
Image scale: containerWidth / crop.width (or containerHeight / crop.height)
Image position: translate(-crop.x * scale, -crop.y * scale)
```

For `fit="cover"` (the common case in collages), the container already handles aspect ratio, so we just need to fill it with the cropped portion.

---

## Changes by File

### 1. `src/components/common/CroppedImage.tsx`

**Replace SVG with CSS-based cropping:**

```text
// For cropped images with fit="cover":
<div className="w-full h-full overflow-hidden">
  <img
    src={src}
    style={{
      width: `${(originalWidth / crop.width) * 100}%`,
      height: `${(originalHeight / crop.height) * 100}%`,
      maxWidth: 'none',
      transform: `translate(
        ${(-crop.x / crop.width) * 100}%,
        ${(-crop.y / crop.height) * 100}%
      )`,
    }}
  />
</div>
```

**Key math explanation:**
- `width: (originalWidth / crop.width) * 100%` scales the image so the crop region equals container width
- `transform: translate(-crop.x/crop.width * 100%, ...)` shifts the image so crop region starts at (0,0)

**For fit="contain"**: Use the same approach but with `object-fit: contain` on a wrapper that maintains the crop's aspect ratio.

**Add React.memo** to prevent unnecessary re-renders.

---

### 2. `src/components/CollagePreview.tsx`

**Memoize photo lookup:**

```text
const photoMap = useMemo(() => 
  new Map(photos.map(p => [p.id, p])), 
  [photos]
);

// Replace: photos.find(p => p.id === cell.photoId)
// With: photoMap.get(cell.photoId)
```

**Extract memoized cell component:**

```text
const CollageCell = React.memo(function CollageCell({ 
  cell, photo, layoutWidth, layoutHeight, ...dragHandlers 
}: CollageCellProps) {
  // Current cell rendering logic
});
```

**Add GPU hints for drag:**

```text
style={{
  ...existingStyles,
  willChange: isBeingDragged ? 'transform, opacity' : 'auto',
}}
```

---

### 3. `src/components/PhotoThumbnail.tsx`

**Add React.memo wrapper:**

```text
export const PhotoThumbnail = React.memo(function PhotoThumbnail({
  // existing props
}: PhotoThumbnailProps) {
  // existing implementation
});
```

---

### 4. `src/test/CroppedImage.test.tsx`

**Update tests for CSS-based rendering:**

The tests currently check for SVG elements when crops are provided. Update to check for:
- `<img>` element with correct inline styles
- Percentage-based transform values
- Proper scaling calculations

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/common/CroppedImage.tsx` | Replace SVG with CSS cropping, add `React.memo` |
| `src/components/CollagePreview.tsx` | Memoize photo lookup, extract cell component, add GPU hints |
| `src/components/PhotoThumbnail.tsx` | Add `React.memo` wrapper |
| `src/test/CroppedImage.test.tsx` | Update to test CSS-based output |

---

## Visual Verification

After implementation, verify these scenarios produce identical output:
1. Uncropped image in collage cell
2. Smart-cropped image in collage cell  
3. Manual-cropped image in collage cell
4. Thumbnail with and without crop
5. Export to PNG (uses same CroppedImage component)

---

## Why This Is Safe

1. **Same coordinates**: The crop `{x, y, width, height}` values are unchanged
2. **Same calculation source**: `getDisplayCrop()` remains the single source of truth
3. **Pure rendering change**: Only how we display the crop, not what we display
4. **Testable**: Side-by-side visual comparison possible before removing SVG path


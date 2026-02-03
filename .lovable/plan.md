
# Fix Smart Crop Thumbnail Not Updating After Save

## Problem Analysis

After saving a new crop in the CropEditor, the "Smart Cropped" thumbnail doesn't update to show the new crop region. The user cropped a photo to show only one person, but after saving, both people are still visible.

---

## Root Cause

After tracing through the entire data flow, I've identified multiple contributing issues:

### Issue 1: Missing `key` on Early Return Paths

The `CroppedImage` component has three return paths:
1. **Early return** when `crop` is `null` (lines 26-38) - **NO key prop**
2. **Early return** when crop is too small (lines 42-54) - **NO key prop**
3. **Full render** with crop transforms (lines 150-165) - has `key` on `<img>`

If React transitions between these paths, or if the crop values don't change enough to trigger a key change, the component may not properly update.

### Issue 2: Key Only on Inner `<img>`, Not Wrapper

The `key` is on the inner `<img>` element, but the wrapper `<div>` has no key. When the crop changes, React might reuse the wrapper div and only update the inner image, which could cause stale rendering.

### Issue 3: Browser Image Caching

Even with React re-rendering, the browser might cache the image at its previous transform position. Adding a key that changes with crop values should force a full DOM recreation.

---

## Solution

### Fix 1: Move `cropKey` Generation Earlier

Calculate `cropKey` at the TOP of the component so it's available for all return paths.

### Fix 2: Add Key to All Return Paths

Apply the `key` prop to images in both early return paths as well.

### Fix 3: Add Key to Wrapper Div

Add the `cropKey` to the wrapper div, ensuring React fully recreates the cropped image container when crop values change.

---

## Implementation

### File: `src/components/common/CroppedImage.tsx`

**Changes:**

1. Move `cropKey` calculation to the top of the component, before any early returns
2. Add `key={cropKey}` to all `<img>` elements (early returns)
3. Keep the existing `key={cropKey}` on the final `<img>` in the full render path

```typescript
export function CroppedImage({
  src,
  crop,
  originalWidth,
  originalHeight,
  fit = 'contain',
  className,
}: CroppedImageProps) {
  // Generate key FIRST, before any early returns
  const cropKey = crop 
    ? `${crop.x.toFixed(0)}-${crop.y.toFixed(0)}-${crop.width.toFixed(0)}-${crop.height.toFixed(0)}` 
    : 'no-crop';

  // Early return: no crop
  if (!crop) {
    return (
      <img
        key={cropKey}  // ADD KEY
        src={src}
        alt=""
        className={cn(
          'w-full h-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className
        )}
        draggable={false}
      />
    );
  }

  // Early return: crop too small
  if (crop.width < 50 || crop.height < 50) {
    return (
      <img
        key={cropKey}  // ADD KEY
        src={src}
        alt=""
        className={cn(
          'w-full h-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className
        )}
        draggable={false}
      />
    );
  }

  // ... rest of the component stays the same ...
  // (crop calculations, transforms, etc.)

  return (
    <div className={cn('relative overflow-hidden w-full h-full', className)}>
      <img
        key={cropKey}  // Already exists
        src={src}
        alt=""
        style={{
          position: 'absolute',
          width: `${scaleFactor * 100}%`,
          height: 'auto',
          transform: `translate(${translateX + centerOffsetX}%, ${translateY + centerOffsetY}%)`,
          transformOrigin: 'top left',
        }}
        draggable={false}
      />
    </div>
  );
}
```

---

## Additional Debugging (Already Verified)

| Component | Status |
|-----------|--------|
| `handleSaveCrop` (Index.tsx) | ✅ Correctly calls `updatePhoto(photoId, { manualCrop: crop })` |
| `updatePhoto` (useCollageState) | ✅ Creates new photo object with spread |
| `PhotoGrid` | ✅ Passes `photo` prop correctly |
| `PhotoThumbnail` | ✅ Prioritizes `manualCrop` over `smartCrop` on line 21 |
| `CroppedImage` | ⚠️ Missing keys on early returns |

---

## Why This Fixes It

When you save a new crop:
1. `photo.manualCrop` gets set with new coordinates
2. `PhotoThumbnail` picks up `manualCrop` (prioritized over `smartCrop`)
3. `CroppedImage` receives the new crop values
4. **New:** The `cropKey` is now calculated immediately
5. **New:** The `key` prop changes, forcing React to fully recreate the `<img>` element
6. The browser renders the image with the new transform values

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/common/CroppedImage.tsx` | Move `cropKey` calculation up, add `key` to early return `<img>` elements |

---

## Technical Note on toFixed(0)

Using `toFixed(0)` rounds the crop values to integers for the key string. This prevents issues where tiny floating-point differences (like `500.0000001` vs `500`) would generate different keys unnecessarily, while still detecting meaningful crop changes.

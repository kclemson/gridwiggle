
# Fix Smart Crop Thumbnail Not Updating After Save

## Problem Analysis

When editing a photo's crop in the CropEditor and saving, the "Smart Cropped" thumbnail doesn't visually update to reflect the new crop region.

### Root Cause

The issue is in how `CroppedImage` renders cropped photos. When the crop changes:
1. The `src` stays the same (same base64 data URL)
2. Only the CSS `transform` and `width` properties change
3. The browser may optimize away the re-render since the image source hasn't changed

Additionally, there's no `key` prop on the `<img>` element to force React to recreate it when crop parameters change significantly.

### Evidence from Console Logs

The console shows a `QuotaExceededError` when saving (localStorage is full due to large base64 images), but this is a separate issue - the in-memory state update still succeeds. The visual update is failing at the rendering layer.

---

## Solution

Add a `key` prop to the `CroppedImage` component that changes when the crop region changes. This forces React to unmount and remount the image element, ensuring the browser renders the new crop.

### File: `src/components/common/CroppedImage.tsx`

Add a key to the inner `<img>` element based on the crop parameters:

```typescript
// Generate a stable key from crop parameters
const cropKey = crop 
  ? `${crop.x}-${crop.y}-${crop.width}-${crop.height}` 
  : 'no-crop';

return (
  <div className={cn('relative overflow-hidden w-full h-full', className)}>
    <img
      key={cropKey}  // Force re-mount when crop changes
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
```

### Alternative Approach: Key at PhotoThumbnail Level

An even cleaner fix is to add the key at the `PhotoThumbnail` level in `PhotoGrid.tsx`:

```typescript
// PhotoGrid.tsx
{photos.map((photo) => (
  <PhotoThumbnail
    key={`${photo.id}-${photo.manualCrop?.x ?? 'none'}-${photo.manualCrop?.y ?? 'none'}`}
    photo={photo}
    // ... rest of props
  />
))}
```

However, this would cause the entire thumbnail to remount (losing hover states, etc.). The more surgical fix is at the `CroppedImage` level.

---

## Additional Fix: Separate localStorage Quota Issue

While not the direct cause, the console shows localStorage is exceeding quota because photo data URLs are being stored. This should be addressed separately:

1. **Don't persist photo data URLs** - they're too large
2. Or **use IndexedDB** instead of localStorage for large data
3. Or **compress/limit stored data**

This is a separate issue but worth noting for future improvement.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/common/CroppedImage.tsx` | Add `key` prop to `<img>` element based on crop parameters to force re-render |

This is a minimal, targeted fix that ensures the browser re-renders the image whenever the crop region changes.

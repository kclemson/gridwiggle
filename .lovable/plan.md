

## Prep Step: Remove Deprecated `getActiveCrop`

Before implementing the slicing floorplan algorithm, we'll clean up the crop source inconsistency.

---

## What We're Fixing

Currently there are two functions for getting a photo's crop:

| Function | Location | Behavior |
|----------|----------|----------|
| `getActiveCrop` (deprecated) | `imageUtils.ts` | Returns raw crop, no validation or clamping |
| `getDisplayCrop` (correct) | `cropUtils.ts` | Validates bounds, clamps to image, returns null if invalid |

The preview uses `getDisplayCrop`, but layout and export still use the deprecated `getActiveCrop`. This could cause subtle mismatches.

---

## Changes

### 1. `src/lib/collageLayout.ts`

**Before:**
```typescript
import { getActiveCrop } from '@/lib/imageUtils';
```

**After:**
```typescript
import { getDisplayCrop } from '@/lib/cropUtils';
```

Update 2 usages:
- Line 76: `getPhotoDimensions()` helper
- Line 489: single-photo layout case in `generateCollageLayout()`

Both change from `getActiveCrop(photo)` to `getDisplayCrop(photo)`.

---

### 2. `src/lib/exportCollage.ts`

**Before:**
```typescript
import { getActiveCrop, loadImage } from '@/lib/imageUtils';
```

**After:**
```typescript
import { loadImage } from '@/lib/imageUtils';
import { getDisplayCrop } from '@/lib/cropUtils';
```

Update 1 usage:
- Line 34: change `getActiveCrop(photo)` to `getDisplayCrop(photo)`

---

### 3. `src/lib/imageUtils.ts`

Remove the deprecated function entirely (lines 49-60):

```typescript
// DELETE THIS:
/**
 * @deprecated Use getDisplayCrop from '@/lib/cropUtils' instead.
 * This function lacks validation and clamping.
 */
export function getActiveCrop(photo: { smartCrop: CropRegion | null; manualCrop: CropRegion | null }): CropRegion | null {
  return photo.manualCrop || photo.smartCrop;
}
```

Also remove the unused `CropRegion` import since it's no longer needed after removing this function.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/collageLayout.ts` | Switch import and 2 usages to `getDisplayCrop` |
| `src/lib/exportCollage.ts` | Switch import and 1 usage to `getDisplayCrop` |
| `src/lib/imageUtils.ts` | Delete deprecated `getActiveCrop` function |

---

## Why This Matters

1. **Consistency**: Layout, preview, and export all use the same validated crop
2. **No dead code**: Deprecated function is gone, not just marked
3. **Clean foundation**: The slicing floorplan algorithm will use the correct crop source from day one
4. **Smaller diff**: Easier to review and verify before the bigger changes

---

## Testing

1. Upload photos, apply smartcrop
2. Verify preview displays correctly
3. Export PNG and verify it matches preview (no crop differences)
4. Apply manual crop, repeat verification


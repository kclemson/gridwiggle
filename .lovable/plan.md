
## Phase 2: Unified Crop Utilities (Single Source of Truth)

### Problem
Crop selection and validation logic is duplicated across 5 files with subtle differences:
- `imageUtils.ts` - `getActiveCrop()` returns manualCrop || smartCrop (no validation)
- `PhotoThumbnail.tsx` - local `isValidCrop()` + inline selection
- `CroppedImage.tsx` - inline validation (width/height >= 50)
- `CropEditor.tsx` - `getDefaultCrop()` with its own selection logic
- `CollagePreview.tsx` - uses `getActiveCrop()` without validation

This means the same photo could show different crops in different places if validation rules diverge.

### Solution
Create a centralized crop utilities module (`src/lib/cropUtils.ts`) that becomes the **single source of truth** for:
1. **Crop precedence**: manualCrop over smartCrop
2. **Validation**: consistent min-size rules
3. **Clamping**: ensure crop stays within image bounds
4. **Default crop generation**: when no valid crop exists

### New File: `src/lib/cropUtils.ts`

```typescript
import { CropRegion, PhotoItem } from '@/types/collage';

// Minimum crop dimension in pixels
const MIN_CROP_SIZE = 50;

/**
 * Check if crop dimensions meet minimum size requirements.
 */
export function isValidCrop(crop: CropRegion): boolean {
  return crop.width >= MIN_CROP_SIZE && crop.height >= MIN_CROP_SIZE;
}

/**
 * Clamp crop coordinates to stay within image bounds.
 * Ensures x, y are non-negative and crop doesn't extend past edges.
 */
export function clampCropToImage(
  crop: CropRegion,
  imageWidth: number,
  imageHeight: number
): CropRegion {
  const x = Math.max(0, Math.min(crop.x, imageWidth - MIN_CROP_SIZE));
  const y = Math.max(0, Math.min(crop.y, imageHeight - MIN_CROP_SIZE));
  const width = Math.max(MIN_CROP_SIZE, Math.min(crop.width, imageWidth - x));
  const height = Math.max(MIN_CROP_SIZE, Math.min(crop.height, imageHeight - y));
  
  return { x, y, width, height };
}

/**
 * Get the preferred crop (manualCrop takes precedence over smartCrop).
 * Does NOT validate - returns raw crop or null.
 */
export function getPreferredCrop(
  photo: { manualCrop: CropRegion | null; smartCrop: CropRegion | null }
): CropRegion | null {
  return photo.manualCrop || photo.smartCrop;
}

/**
 * Get the display-ready crop for a photo.
 * Returns null if no valid crop exists or dimensions are missing.
 * This is the main function to use for rendering.
 */
export function getDisplayCrop(photo: PhotoItem): CropRegion | null {
  // Can't compute crop without dimensions
  if (!photo.originalWidth || !photo.originalHeight) {
    return null;
  }
  
  const crop = getPreferredCrop(photo);
  if (!crop) {
    return null;
  }
  
  // Clamp to image bounds
  const clamped = clampCropToImage(crop, photo.originalWidth, photo.originalHeight);
  
  // Validate after clamping
  if (!isValidCrop(clamped)) {
    return null;
  }
  
  return clamped;
}

/**
 * Get initial crop for the crop editor.
 * If no valid crop exists, returns a centered 80% crop.
 */
export function getEditorInitialCrop(photo: PhotoItem): CropRegion {
  const displayCrop = getDisplayCrop(photo);
  if (displayCrop) {
    return { ...displayCrop };
  }
  
  // Default to center crop with 80% size
  const size = Math.min(photo.originalWidth, photo.originalHeight) * 0.8;
  return {
    x: (photo.originalWidth - size) / 2,
    y: (photo.originalHeight - size) / 2,
    width: size,
    height: size,
  };
}
```

### Files to Update

#### 1. `src/components/PhotoThumbnail.tsx`
- Remove local `isValidCrop` function
- Import and use `getDisplayCrop` from cropUtils
- Simplify the crop logic

```typescript
// BEFORE (lines 15-23):
function isValidCrop(crop: CropRegion): boolean {
  return crop.width >= 50 && crop.height >= 50;
}
// ... then inline logic to get rawCrop and activeCrop

// AFTER:
import { getDisplayCrop } from '@/lib/cropUtils';
// ... then simply:
const activeCrop = showCropped ? getDisplayCrop(photo) : null;
```

#### 2. `src/components/CropEditor.tsx`
- Remove local `getDefaultCrop` function
- Import and use `getEditorInitialCrop` from cropUtils

```typescript
// BEFORE (lines 12-25):
function getDefaultCrop(photo: PhotoItem): CropRegion { ... }

// AFTER:
import { getEditorInitialCrop } from '@/lib/cropUtils';
// ... then:
const [crop, setCrop] = useState<CropRegion>(() => getEditorInitialCrop(photo));
```

#### 3. `src/components/CollagePreview.tsx`
- Replace `getActiveCrop` import with `getDisplayCrop`
- This adds validation that was previously missing

```typescript
// BEFORE (line 3):
import { getActiveCrop } from '@/lib/imageUtils';
// ... then (line 120):
const crop = getActiveCrop(photo);

// AFTER:
import { getDisplayCrop } from '@/lib/cropUtils';
// ... then:
const crop = getDisplayCrop(photo);
```

#### 4. `src/components/common/CroppedImage.tsx`
- Keep existing inline validation as defensive fallback
- The validation is already consistent (>= 50), so no change needed
- Components calling CroppedImage should pre-validate, but the component remains defensive

#### 5. `src/lib/imageUtils.ts`
- Keep `getActiveCrop` for now (gradual migration)
- Add deprecation comment pointing to cropUtils

### Summary of Changes

| File | Change |
|------|--------|
| `src/lib/cropUtils.ts` | **NEW** - Centralized crop utilities |
| `src/components/PhotoThumbnail.tsx` | Use `getDisplayCrop`, remove local validation |
| `src/components/CropEditor.tsx` | Use `getEditorInitialCrop`, remove local function |
| `src/components/CollagePreview.tsx` | Use `getDisplayCrop` instead of `getActiveCrop` |
| `src/lib/imageUtils.ts` | Add deprecation comment to `getActiveCrop` |

### Benefits

1. **Consistency**: Same validation rules everywhere
2. **Debuggability**: One place to add logging/debugging
3. **Maintainability**: Change min-size in one place, applies everywhere
4. **Correctness**: Clamping ensures edge cases don't cause out-of-bounds crops

### What This Fixes

If the thumbnail and editor are both calling `getDisplayCrop(photo)` (thumbnail) and `getEditorInitialCrop(photo)` (editor), they will use the **exact same underlying logic** to select and validate the crop. Any mismatch would then clearly be a state/timing issue, not a logic divergence issue.

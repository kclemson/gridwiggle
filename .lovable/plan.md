

## Fix: Smart Cropped Thumbnails Should Match Crop Editor

### Summary
Change the Smart Cropped grid to use `fit="contain"` so thumbnails show the exact same region visible in the crop editor.

### Root Cause
The Smart Cropped grid uses `fit="cover"` which clips non-square crops to fill the square thumbnail. This creates a visual mismatch between the thumbnail and the crop editor.

### Solution
Single-line change in `PhotoThumbnail.tsx` - use `contain` for all thumbnails regardless of whether a crop is active.

### Code Change

**File:** `src/components/PhotoThumbnail.tsx`

```text
Line 25-27 (before):
  // Use "cover" when displaying a crop so the cropped region fills the thumbnail
  // Use "contain" for original photos to show the full image
  const fitMode = showCropped && activeCrop ? 'cover' : 'contain';

Line 25-27 (after):
  // Always use "contain" so thumbnails show the full image/crop region
  // This ensures the thumbnail matches what the user sees in the crop editor
  const fitMode = 'contain';
```

### Visual Impact
- **Original Photos grid**: No change (was already `contain`)
- **Smart Cropped grid**: Will now show full crop region with letterboxing for non-square crops
- **Collage Preview**: No change (uses its own `fit="cover"` for cell filling)

### Why This Is Safe
There were no documented technical issues with `contain` in the past. The `cover` mode was a design choice that prioritized "filled thumbnails" over "accurate preview". Switching to `contain` simply prioritizes accuracy.

### Test Plan
1. Upload a photo
2. Check Smart Cropped thumbnail - should show full crop with possible letterboxing
3. Click to open Crop Editor - visible region should match thumbnail exactly
4. Adjust to a landscape crop, save
5. Thumbnail should update to show full landscape crop with top/bottom letterboxing
6. Verify Original Photos grid still shows full image properly


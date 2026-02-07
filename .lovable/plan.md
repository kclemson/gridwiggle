
# Fix CSS Crop Math in CroppedImage Component

## Problem

The crop selected in the "Adjust Crop" dialog isn't being displayed correctly in the carousel thumbnail or collage preview. The user sets a square crop focused on the flower, but the full image (including the stem) is visible instead.

## Root Cause

The CSS transform translation calculation in `CroppedImage.tsx` is incorrect. The current math computes the translation relative to the crop dimensions:

```tsx
const translateX = (-crop.x / crop.width) * 100;  // Wrong basis
const translateY = (-crop.y / crop.height) * 100; // Wrong basis
```

**Problem**: CSS `translate()` percentages are relative to the **element's own size** (the scaled image), not the container or crop dimensions.

### Math Breakdown

For an image 1000×750 with crop at (100, 50, 500, 400):

| Step | Current (Wrong) | Correct |
|------|-----------------|---------|
| Scale image width | 200% (1000/500) | 200% |
| Scale image height | 187.5% (750/400) | 187.5% |
| Scaled image size (100×80 container) | 200px × 150px | 200px × 150px |
| translateX calculation | -100/500 = -20% | -100/1000 = -10% |
| translateY calculation | -50/400 = -12.5% | -50/750 = -6.67% |
| **Actual pixel translation** | -20% × 200px = **-40px** | -10% × 200px = **-20px** |
| **Needed translation** | (scale × crop.x) | **-20px** |

The current formula over-translates by `originalSize / cropSize` factor.

## Solution

Change the translation basis from crop dimensions to original image dimensions:

**File**: `src/components/common/CroppedImage.tsx`

**Current** (lines 88-89):
```tsx
const translateX = (-crop.x / crop.width) * 100;
const translateY = (-crop.y / crop.height) * 100;
```

**Fixed**:
```tsx
const translateX = (-crop.x / originalWidth) * 100;
const translateY = (-crop.y / originalHeight) * 100;
```

### Why This Works

CSS `translate(X%, Y%)` moves by percentage of **element dimensions**.

- Scaled image size: `(originalWidth / crop.width)` of container = `scaleX%`
- In container pixels: if container is `C` wide, scaled image is `C × scaleX/100` wide
- To shift crop.x pixels in source coords to origin: translate by `-crop.x` source pixels
- At scale, that's `-(crop.x / originalWidth) × 100%` of the scaled image

This formula correctly positions the crop region at the container's origin.

## Verification

Using the test case (1000×750 image, crop at x=100, y=50, 500×400):
- scaleX = 200%, scaleY = 187.5% (unchanged)
- translateX = -100/1000 × 100 = **-10%**
- translateY = -50/750 × 100 = **-6.67%**
- In a 100×80 container: image is 200×150, translate is -20px, -10px
- This correctly shows the crop region (100→600, 50→450) at the container origin


# Fix Photo Clipping - Root Cause and Solution

## Problem Identified

Photos are being clipped because **cell aspect ratios don't match photo crop aspect ratios**.

### The Math Behind the Clipping

In row-based packing (used by `packPhotosIntoRegion`):

```
Row height = availableWidth / sum(aspectRatios)
Photo width = (photoAspectRatio / sum) × availableWidth
```

For a row with photos A (aspect 1.5) and B (aspect 0.8):
- `aspectSum = 2.3`
- `rowHeight = 1000 / 2.3 = 435px`
- Photo A width = `(1.5 / 2.3) × 1000 = 652px`
- Photo A cell aspect = `652 / 435 = 1.50` ✓ (matches original!)

**The math IS correct** - the algorithm DOES create cells that match aspect ratios. But there are two issues:

### Issue 1: Integer Rounding

```typescript
cells.push({
  ...
  width: Math.round(photoWidth),  // Rounds to integer
  height: Math.round(height),     // Rounds to integer
});
```

Rounding creates small mismatches:
- Photo A: aspect 1.5 → cell 652×435 = 1.499
- SVG `slice` mode clips even small mismatches

### Issue 2: The `packVerticalStripWithUniformScale` Adds Error

This function takes cells from `packPhotosIntoRegion` and scales them, but the scaling introduces additional rounding errors.

## Solution: Use `fit="contain"` Instead of `fit="cover"`

The simplest fix is to change how we render images in cells. Instead of clipping to fill (`cover`), we should fit the image within the cell (`contain`).

**BUT** this would create letterboxing (visible gaps around photos) which isn't ideal either.

## Better Solution: Ensure Cell Aspect Matches Exactly

The real fix is to ensure each cell's aspect ratio **exactly** matches its photo's crop aspect ratio, eliminating any need for cover/contain logic.

For the **below zone** (row-based packing), the current algorithm is correct because all photos in a row share the same row height calculated from their combined aspect ratios.

For the **side strips** (vertical packing), we use `packVerticalColumn` which calculates exact widths per photo. This should be correct.

**The problem is likely the uniform scaling in `packVerticalStripWithUniformScale`** used for the floating hero layout with many photos.

## Root Cause: `packVerticalStripWithUniformScale` Still Used

Looking at `generateFloatingHeroLayout` (lines 418-500):
- Lines 471-472: `packVerticalStripWithUniformScale(leftPhotos, leftWidth, heroSize.height, 0, 0, gap)`
- Lines 476-477: `packVerticalStripWithUniformScale(rightPhotos, rightWidth, heroSize.height, rightX, 0, gap)`

This function (lines 247-284):
1. Calls `packPhotosIntoRegion` which creates a MULTI-ROW layout
2. Then scales uniformly to match target height

The issue: The scaled cell dimensions don't match original photo aspect ratios because:
- Row packing creates cells where all photos in a row share height
- Uniform scaling preserves the CELL aspect ratios, not the PHOTO aspect ratios

When you have 3 photos with aspects [1.5, 0.8, 1.2] in a row:
- They each get the same row height
- Their widths are proportional to their aspects
- Each cell aspect IS correct for its photo

But if you then SCALE that row to a different height, the cell aspects stay the same - which is correct!

## The ACTUAL Root Cause: Floating Hero Not Using Edge-Anchored Layout

With 24 photos and `FEW_PHOTOS_THRESHOLD = 8`, the algorithm uses `generateFloatingHeroLayout` because 23 standards > 8.

Looking at the screenshot, the left/right strip photos are clipped. This happens because:
1. `packPhotosIntoRegion` is designed for full-width rows
2. When used for a narrow vertical strip, it creates rows that are too wide for the strip width
3. The uniform scaling then compresses them

## Fix: Always Use Simple Vertical Column for Side Strips

The `packVerticalColumn` function (lines 204-240) calculates the **exact natural width** for photos to stack vertically. It creates cells with correct aspect ratios.

Replace `packVerticalStripWithUniformScale` usage with `packVerticalColumn` for ALL cases.

---

## Implementation

### Change 1: Remove `packVerticalStripWithUniformScale` Usage

In `generateFloatingHeroLayout`, replace the strip packing:

```typescript
// Current (broken):
const leftCells = hasLeft 
  ? packVerticalStripWithUniformScale(leftPhotos, leftWidth, heroSize.height, 0, 0, gap)
  : [];

// Fixed:
const { cells: leftCells, width: actualLeftWidth } = hasLeft 
  ? packVerticalColumn(leftPhotos, heroSize.height, 0, 0, gap)
  : { cells: [], width: 0 };
```

### Change 2: Adjust Hero Position Based on Actual Strip Widths

Since `packVerticalColumn` calculates the natural width (not a fixed width), we need to position the hero based on actual strip widths:

```typescript
// Position hero: leave room for actual left strip width
const heroX = actualLeftWidth > 0 ? actualLeftWidth + gap : 0;
```

### Change 3: Handle "Strip Too Wide" Case

If the natural strip width is larger than the available space, we need to redistribute photos to the below zone:

```typescript
const { cells: leftCells, width: leftWidth } = packVerticalColumn(leftPhotos, heroSize.height, 0, 0, gap);

if (leftWidth > maxLeftWidth) {
  // Strip too wide - move photos to below zone
  belowPhotos = [...leftPhotos, ...belowPhotos];
  leftCells = [];
}
```

---

## File Changes

| File | Change |
|------|--------|
| `src/lib/heroLayout.ts` | Replace `packVerticalStripWithUniformScale` with `packVerticalColumn` |
| `src/lib/heroLayout.ts` | Adjust hero positioning based on actual strip widths |
| `src/lib/heroLayout.ts` | Add overflow handling when strips are too wide |
| `src/lib/heroLayout.ts` | Remove unused `packVerticalStripWithUniformScale` function |

---

## Technical Details

### Why `packVerticalColumn` Works

```typescript
function packVerticalColumn(
  photos: PhotoDimension[],
  targetHeight: number,
  offsetX: number,
  offsetY: number,
  gap: number
): { cells: CollageCell[]; width: number } {
  // Calculate width needed for photos to fill targetHeight exactly
  const columnWidth = calculateNaturalStripWidth(photos, targetHeight, gap);
  
  // Pack each photo at that width, with correct aspect ratio
  for (const photo of photos) {
    const cellHeight = columnWidth / photo.aspectRatio;  // Exact aspect match!
    cells.push({...});
  }
}
```

Each cell's aspect ratio exactly matches its photo because:
- `cellWidth = columnWidth`
- `cellHeight = columnWidth / photo.aspectRatio`
- `cellAspect = cellWidth / cellHeight = photo.aspectRatio` ✓

### Expected Results

1. **No clipping** - Each cell matches its photo's aspect ratio exactly
2. **Side strips may not fill available width** - This is acceptable; the alternative is clipping
3. **Better visual harmony** - Photos display at their natural proportions

---

## Alternative Approach: Accept Some Gaps

If side strips don't fill the full available width, there will be a gap between the strip and the hero. This could be:

1. **Accepted as-is** - Small gaps are less jarring than clipped photos
2. **Filled with background color** - Already happens since the gap color fills unused space
3. **Redistributed to below zone** - Move more photos to below to keep strip width reasonable

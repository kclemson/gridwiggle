

# Fix: Spacing Slider Not Working for Non-Hero Layouts

## What's Happening

When you move the spacing slider, nothing changes because the layout algorithm ignores your gap setting when there's no hero photo.

The logs show `heroCount: 0`, which means the "simple rows" layout path is being used. This path has a bug where it uses a hardcoded gap value (`0.02`) instead of your actual spacing setting.

## What You'll Experience After This Fix

- Moving the spacing slider immediately updates the gaps between photos
- Works for both hero layouts (already working) and regular layouts (broken until now)

---

## Technical Details

### Root Cause

In `src/lib/v3/intersection.ts`, the `generateSimpleRowsLayout` function:

```typescript
function generateSimpleRowsLayout(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,        // ← receives pixel gap but NEVER USES IT
  tuning: V3Tuning
): ScoredConfiguration | null {
  // ...
  const estimatedNormalizedGap = 0.02;  // ← hardcoded, ignores actual gap
```

The `gap` parameter (0-32px from slider) is passed in but completely ignored.

### The Fix

**Step 1: Calculate proper normalized gap from pixel gap**

Similar to how `evaluateNormalizedProposal` works, we need to:
1. Use a small fixed normalized gap for geometry/packing calculations (so row distribution stays stable)
2. Apply the actual pixel gap when converting cells to final positions

**Step 2: Add gap offset when converting cells to pixels**

Currently cells are just scaled:
```typescript
x: cell.x * scaleFactor,
y: cell.y * scaleFactor,
```

This doesn't account for gaps between rows. Need to add:
```typescript
// Track cumulative gap offset for each row
y: cell.y * scaleFactor + (rowIndex * pixelGap),
```

### Files to Change

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Update `generateSimpleRowsLayout` to apply pixel gap when converting cells |

### Code Changes

**Lines 486-555 in `generateSimpleRowsLayout`:**

1. Change cell conversion to apply pixel gaps between rows
2. Update canvas height calculation to include gap space

```typescript
// Current (broken):
const cells: LayoutCell[] = normalizedResult.cells.map(cell => ({
  photoId: cell.photoId,
  x: cell.x * scaleFactor,
  y: cell.y * scaleFactor,
  width: cell.width * scaleFactor,
  height: cell.height * scaleFactor,
}));

// Fixed:
// Track which row each cell is in to apply correct gap offset
const cells: LayoutCell[] = normalizedResult.cells.map(cell => {
  // Determine row index from Y position (cells in same row have same Y)
  // rowHeight is approximately 1/rowCount of total height
  const approxRowHeight = normalizedResult.height / rowCount;
  const rowIndex = Math.round(cell.y / approxRowHeight);
  
  return {
    photoId: cell.photoId,
    x: cell.x * scaleFactor,
    y: cell.y * scaleFactor + (rowIndex * gap), // Add gap offset per row
    width: cell.width * scaleFactor,
    height: cell.height * scaleFactor,
  };
});

// Update canvas height to include gaps
const totalGapHeight = (rowCount - 1) * gap;
const actualCanvasHeight = normalizedResult.height * scaleFactor + totalGapHeight;
```

This mirrors how the hero layout applies gaps - geometry is calculated in normalized space, then pixel gaps are added during the final conversion.


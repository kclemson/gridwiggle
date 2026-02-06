

# Fix: BESIDE Column Should Scale to Fit Target Height

## Problem Identified

When the BESIDE region is a vertical column (1 photo per row), the current logic:
1. Stretches all photos to the widest photo's width (`maxRowWidth`)
2. Recalculates heights to preserve each photo's aspect ratio
3. Returns the new `finalHeight` as the column height

But stretching narrow photos (AR < 1) wider makes them **taller**. For example:
- Photo B (AR 0.73) at width 1.0 → height = 1.0/0.73 = 1.37
- Photo E (AR 0.88) at width 1.0 → height = 1.0/0.88 = 1.14

So the column of 4 photos with 3 gaps becomes much taller than 1.0, causing the visual overflow.

## Design Intent

**What should happen:**
- The BESIDE column should fill exactly `targetHeight` (1.0 in normalized space)
- All photos in the column have the same width (flush edges)
- Each photo's height preserves its aspect ratio
- The column width is derived from: what width makes the total height = targetHeight?

**The Math:**
For a column of n photos at common width W:
- Each photo's height = W / AR_i
- Total height = sum(W / AR_i) + (n-1) × gap = W × sum(1/AR_i) + (n-1) × gap
- Setting total height = targetHeight:
  - W = (targetHeight - (n-1) × gap) / sum(1/AR_i)

---

## Technical Fix

### File: `src/lib/v3/normalized-pack.ts`

Replace the current "stretch and recalculate" logic with proper column scaling:

```typescript
// === Handle column mode: all photos stacked vertically ===
// When each row has exactly 1 photo, we're in column mode.
// In this case, all photos should have the SAME WIDTH, and the
// column should fit exactly within targetHeight.

const allSinglePhotoRows = rows.every(row => row.length === 1);

if (allSinglePhotoRows) {
  // Column mode: derive width from targetHeight constraint
  // Total height = W × sum(1/AR) + (n-1) × gap = targetHeight
  // So: W = (targetHeight - (n-1) × gap) / sum(1/AR)
  
  const sumInverseAR = photos.reduce((sum, p) => sum + 1 / p.aspectRatio, 0);
  const totalGapHeight = (photos.length - 1) * normalizedGap;
  const columnWidth = (targetHeight - totalGapHeight) / sumInverseAR;
  
  if (columnWidth <= 0) {
    return { cells: [], width: 0, height: 0, rowCount: 0 };
  }
  
  // Position photos vertically at columnWidth
  const columnCells: NormalizedCell[] = [];
  let y = 0;
  
  photos.forEach(photo => {
    const cellHeight = columnWidth / photo.aspectRatio;
    columnCells.push({
      photoId: photo.id,
      x: 0,
      y,
      width: columnWidth,
      height: cellHeight,
    });
    y += cellHeight + normalizedGap;
  });
  
  return {
    cells: columnCells,
    width: columnWidth,
    height: targetHeight,  // Exactly fills the target
    rowCount: photos.length,
  };
}
```

This replaces the current second-pass stretching logic. Insert this check **after** distributing to rows but **before** the standard row packing loop.

---

## Expected Result

- Column of 4 portrait photos will fill exactly the hero height (1.0)
- All photos have flush edges (same width)
- Each photo's height is proportional to its AR
- The column width is derived from the geometry, not arbitrary

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/normalized-pack.ts` | Add column mode detection and proper height-constrained packing |


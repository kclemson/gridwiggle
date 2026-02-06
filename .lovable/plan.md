

# Fix: BESIDE Column Packing Should Stretch Photos to Same Width

## Problem

When the BESIDE region has 1 photo per row (vertical column), each photo gets its own width based on AR × rowHeight, causing misaligned edges:

- Photo B (AR 0.73): narrower
- Photo C (AR 0.79): slightly wider  
- Photo D (AR 0.86): wider still
- Photo E (AR 0.88): widest

They're left-aligned, leaving ragged gaps on the right side.

## What Should Happen

In a vertical column arrangement, all photos should:
1. Share the SAME width (the column width)
2. Have their heights calculated from that width to preserve AR

---

## Technical Fix

### File: `src/lib/v3/normalized-pack.ts`

Update `packToFillHeight` to handle the 1-photo-per-row case as proper column packing:

**After calculating `maxRowWidth` (the widest row), add a second pass to stretch all cells:**

```typescript
// Pack rows and find max width
let maxRowWidth = 0;
const cells: NormalizedCell[] = [];
let currentY = 0;

rows.forEach(row => {
  const cellWidths = row.map(p => p.aspectRatio * rowHeight);
  const rowWidth = cellWidths.reduce((sum, w) => sum + w, 0) + (row.length - 1) * normalizedGap;
  
  if (rowWidth > maxRowWidth) {
    maxRowWidth = rowWidth;
  }
  
  // Place cells (will stretch in second pass if needed)
  let currentX = 0;
  row.forEach((photo, i) => {
    const cellWidth = cellWidths[i];
    cells.push({
      photoId: photo.id,
      x: currentX,
      y: currentY,
      width: cellWidth,
      height: rowHeight,
    });
    currentX += cellWidth + normalizedGap;
  });
  
  currentY += rowHeight + normalizedGap;
});

// === NEW: Stretch single-photo rows to fill column width ===
// If a row has only 1 photo, stretch it to maxRowWidth
// This ensures vertical columns have flush edges
cells.forEach(cell => {
  // Find if this cell is alone in its row (no other cells at same Y)
  const cellsAtSameY = cells.filter(c => Math.abs(c.y - cell.y) < 0.001);
  if (cellsAtSameY.length === 1) {
    // Single photo in this row - stretch to full width
    const photo = photos.find(p => p.id === cell.photoId);
    if (photo) {
      // New width is the column width
      const newWidth = maxRowWidth;
      // New height preserves aspect ratio
      const newHeight = newWidth / photo.aspectRatio;
      cell.width = newWidth;
      cell.height = newHeight;
    }
  }
});

// === NEW: Recalculate Y positions after height changes ===
// Sort cells by original Y to maintain order
const sortedCells = [...cells].sort((a, b) => a.y - b.y);
let newY = 0;
sortedCells.forEach(cell => {
  cell.y = newY;
  newY += cell.height + normalizedGap;
});

// Update total height
const finalHeight = Math.max(0, newY - normalizedGap);

return {
  cells: sortedCells,
  width: maxRowWidth,
  height: finalHeight, // Use recalculated height
  rowCount: rows.length,
};
```

---

## Design Intent

**What this achieves:**
- Vertical columns (1 photo per row) now have flush edges
- All photos in the column share the same width
- Heights adjust to preserve each photo's aspect ratio
- The column fills the hero height properly

**Trade-off:**
- The total height of the column may exceed the original `targetHeight` because stretching narrow photos makes them taller
- This is actually correct - if photos stretch wider, they must grow taller to keep AR

---

## Alternative Approach: Detect Column Mode Upfront

Instead of fixing cells in a second pass, we could detect "column mode" (rowCount >= photoCount) and use a different packing algorithm:

```typescript
if (rowCount >= photos.length) {
  // Column mode: pack vertically with fixed width
  return packAsColumn(photos, targetHeight, normalizedGap);
}
```

This would be cleaner but requires a new function. The second-pass approach works with the existing structure.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/normalized-pack.ts` | Add second pass in `packToFillHeight` to stretch single-photo rows to column width and recalculate heights |



## Option B: Row Height Re-flow After Photo Swap

When photos are swapped between rows via drag-and-drop, recalculate the optimal height for each affected row so photos display at their true aspect ratios without cropping. Rows below shift vertically to accommodate.

---

## How It Works

```text
Before swap:
  Row 1 (y=0, h=200):   [A landscape] [B landscape] [C landscape]
  Row 2 (y=210, h=300): [D portrait] [E square]
  Row 3 (y=520, h=180): [F wide] [G wide]

Swap A ↔ D:

After swap:
  Row 1 (y=0, h=260):   [D portrait] [B landscape] [C landscape]  ← taller
  Row 2 (y=270, h=240): [A landscape] [E square]                  ← shorter
  Row 3 (y=520, h=180): [F wide] [G wide]                         ← shifted
```

---

## File Changes

### 1. `src/lib/collageLayout.ts`

Add new `reflowAfterSwap` function:

**Algorithm:**
1. Swap the photo IDs in cells
2. Group cells by `y` position (each group = one row)
3. For each row, recalculate optimal height: `height = availableWidth / aspectSum`
4. Redistribute cell widths proportionally: `width = (aspect / aspectSum) × availableWidth`
5. Cascade `y` positions from top to bottom
6. Update total collage height

**New export:**
```typescript
export function reflowAfterSwap(
  layout: CollageLayout,
  photos: PhotoItem[],
  photoId1: string,
  photoId2: string,
  gap: number
): CollageLayout
```

Uses existing `getDisplayCrop` helper from `cropUtils.ts` to get each photo's current aspect ratio.

---

### 2. `src/pages/Index.tsx`

Update `handleSwapPhotos` to use the new function:

**Before:**
```typescript
const handleSwapPhotos = useCallback((photoId1: string, photoId2: string) => {
  if (state.layout) {
    const newLayout = swapPhotosInLayout(state.layout, photoId1, photoId2);
    setLayout(newLayout);
  }
}, [state.layout, setLayout]);
```

**After:**
```typescript
const handleSwapPhotos = useCallback((photoId1: string, photoId2: string) => {
  if (state.layout) {
    const newLayout = reflowAfterSwap(
      state.layout,
      state.photos,
      photoId1,
      photoId2,
      state.settings.gapSize
    );
    setLayout(newLayout);
  }
}, [state.layout, state.photos, state.settings.gapSize, setLayout]);
```

---

## Technical Details

### Row Identification
Cells are grouped by their `y` coordinate - cells with the same `y` are in the same row.

### Height Calculation Math
For photos with aspect ratios `a₁, a₂, a₃...` in a row:
```
availableWidth = collageWidth - (gaps between cells)
aspectSum = a₁ + a₂ + a₃ + ...
rowHeight = availableWidth / aspectSum
```

### Width Distribution
Each cell's width is proportional to its aspect ratio:
```
cellWidth_i = (a_i / aspectSum) × availableWidth
```

This guarantees `cellWidth / cellHeight = aspectRatio` (no cropping).

### Cascading Y Positions
After recalculating all row heights, iterate top-to-bottom updating `y`:
```
currentY = 0
for each row (sorted by original y):
  set all cells in row to y = currentY
  currentY += rowHeight + gap
```

---

## Behavior Summary

| Scenario | Result |
|----------|--------|
| Same-row swap | Just swap IDs, no geometry change needed |
| Cross-row swap (similar aspects) | Small height adjustments |
| Cross-row swap (portrait ↔ landscape) | Noticeable height changes, rows shift |
| Collage total height | Updates to fit new row heights |

---

## Undo Stack Ready

The function returns a new immutable `CollageLayout` object, making it straightforward to integrate with a future undo stack - each swap produces a complete layout snapshot that can be pushed to history.

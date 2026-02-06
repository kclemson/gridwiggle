

# Fixing V3 Layout Test Issues - Step 1

We'll tackle these issues separately to avoid tangling. Let me start with two focused fixes:

## Fix 1: Hero Border Inside (Styling)

**File**: `src/components/layout-rating/LayoutVisualization.tsx`

Current styling uses `ring-2 ring-amber-400` which renders OUTSIDE the element.

**Change line 96**:
```tsx
// Before
isHero && "ring-2 ring-amber-400 z-10"

// After  
isHero && "border-2 border-amber-400 z-10"
```

Or use `ring-inset`:
```tsx
isHero && "ring-2 ring-inset ring-amber-400 z-10"
```

---

## Fix 2: Cells Overflowing Canvas (Critical Bug)

Looking at screenshot 3, cells B and C extend beyond the canvas boundary. This is a bug in `scaleToFillHeight` in `row-pack.ts`.

**Root Cause**: When scaling cells to fill height, the width scales proportionally. But the code doesn't re-pack the row horizontally - it just adjusts X based on the original positions. When scaled, cells can exceed the region width.

**Current buggy code** (lines 192-201):
```typescript
// Center each row horizontally
rows.forEach(row => {
  row.sort((a, b) => a.x - b.x);
  const rowWidth = row.reduce((sum, cell) => sum + cell.width, 0) + (row.length - 1) * 0; // gaps already scaled
  const xOffset = (region.width - rowWidth) / 2;
  
  let currentX = region.x + xOffset;
  row.forEach(cell => {
    cell.x = currentX;
    currentX += cell.width; // gap is implicit in spacing
  });
});
```

**Problems**:
1. Gap isn't being added between cells (`+ (row.length - 1) * 0` - the `* 0` is wrong)
2. If `rowWidth > region.width`, `xOffset` becomes negative, pushing cells outside

**Fix**: After scaling, re-pack cells to fit within region bounds. If scaled row is wider than region, we need to clamp or not apply fillHeight scaling.

**File**: `src/lib/v3/row-pack.ts`

```typescript
function scaleToFillHeight(
  result: PackingResult,
  region: RegionSpec,
  fillHeight: number
): PackingResult {
  const scaleFactor = fillHeight / result.actualHeight;
  
  // Scale all cells
  const scaledCells = result.cells.map(cell => {
    const newHeight = cell.height * scaleFactor;
    const newWidth = cell.width * scaleFactor;
    
    // Scale Y offset from region top
    const yOffset = (cell.y - region.y) * scaleFactor;
    
    return {
      photoId: cell.photoId,
      x: cell.x,
      y: region.y + yOffset,
      width: newWidth,
      height: newHeight,
    };
  });
  
  // Group cells by row (same Y position within threshold)
  const rows: typeof scaledCells[] = [];
  scaledCells.forEach(cell => {
    const existingRow = rows.find(row => 
      row.length > 0 && Math.abs(row[0].y - cell.y) < 1
    );
    if (existingRow) {
      existingRow.push(cell);
    } else {
      rows.push([cell]);
    }
  });
  
  // Calculate gap from original spacing
  const originalGap = result.cells.length > 1 
    ? result.cells[1].x - (result.cells[0].x + result.cells[0].width)
    : 0;
  const scaledGap = originalGap * scaleFactor;
  
  // Pack each row to fit region width
  rows.forEach(row => {
    row.sort((a, b) => a.x - b.x);
    const rowWidth = row.reduce((sum, cell) => sum + cell.width, 0) 
      + (row.length - 1) * scaledGap;
    
    // Clamp row to fit region - scale down cells if needed
    if (rowWidth > region.width) {
      const clampScale = region.width / rowWidth;
      row.forEach(cell => {
        cell.width *= clampScale;
        cell.height *= clampScale;
      });
    }
    
    // Calculate actual row width after potential clamping
    const finalRowWidth = row.reduce((sum, cell) => sum + cell.width, 0)
      + (row.length - 1) * scaledGap * (rowWidth > region.width ? region.width / rowWidth : 1);
    
    // Center horizontally
    const xOffset = (region.width - finalRowWidth) / 2;
    
    let currentX = region.x + xOffset;
    row.forEach(cell => {
      cell.x = currentX;
      currentX += cell.width + scaledGap;
    });
  });
  
  // ... rest unchanged
}
```

---

## What About Issues 1 & 2 (Blank Space)?

These require deeper architectural discussion. The current "corner" decomposition creates only **2 regions** (beside + below), not **3 regions** (left + right + below).

Your mockups show:
- 3 "slices": left of hero, right of hero, below hero

Current architecture:
- 2 regions: one beside (left OR right), one below

To achieve what you're showing, we'd need to implement **"edge" mode** which would create 3 regions. This is a bigger change that we should discuss separately.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/layout-rating/LayoutVisualization.tsx` | Hero border inside |
| `src/lib/v3/row-pack.ts` | Fix cell overflow after height scaling |


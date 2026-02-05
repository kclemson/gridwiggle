

# Plan: Fix Dynamic Tag Label Issues

## Summary

Three fixes needed for the dynamic tag labels in the layout rating tool.

---

## Issue 1: Hero Not Prominent Shows 300% (Bug Fix)

**Root Cause**: In `layoutAdapter.ts` line 70, `cellAreaPercents` is computed as integers 0-100:
```typescript
const cellAreaPercents = layout.cells
  .map(cell => Math.round((cell.width * cell.height) / canvasArea * 100))
  .sort((a, b) => b - a);
```

But in `TagCheckboxes.tsx` line 28, we multiply by 100 again:
```typescript
.map(p => `${Math.round(p * 100)}%`)
```

This results in `3 * 100 = 300%` instead of `3%`.

**Fix**: Remove the `* 100` multiplication in `TagCheckboxes.tsx` since `cellAreaPercents` is already in percentage form:

```typescript
case 'hero-not-prominent':
  if (heroCoverage !== null && cellAreaPercents.length >= 4) {
    const top3NonHero = cellAreaPercents.slice(1, 4)
      .map(p => `${Math.round(p)}%`).join('/');
    return `Hero not prominent (${Math.round(heroCoverage * 100)}% vs ${top3NonHero})`;
  }
```

---

## Issue 2: Mark Hero-Adjacent Rows with "H"

**Goal**: Change `[5, 4, 4, 6, 5, 6, 5, 5, 5, 5]` to `[5H, 4H, 4H, 6, 5, 6, 5, 5, 5, 5]` where rows overlap vertically with the hero cell.

**Changes in `layoutAdapter.ts`**:

1. Add a new field to `LayoutTestResult` in `types.ts`:
   ```typescript
   rowHeroAdjacent: boolean[];  // Which rows are vertically adjacent to hero
   ```

2. Update `calculateMetrics` to detect which rows overlap with the hero's Y range:
   ```typescript
   // Find hero cell bounds
   let heroYMin = 0, heroYMax = 0;
   if (heroPhoto) {
     const heroCell = layout.cells.find(c => c.photoId === heroPhoto.id);
     if (heroCell) {
       heroYMin = heroCell.y;
       heroYMax = heroCell.y + heroCell.height;
     }
   }
   
   // Mark rows that overlap with hero Y range
   const rowHeroAdjacent = sortedYs.map(y => {
     const rowCells = cellsByY.get(y)!;
     const rowHeight = Math.max(...rowCells.map(c => c.height));
     const rowYMax = y + rowHeight;
     // Row overlaps with hero if ranges intersect
     return heroPhoto !== undefined && 
            y < heroYMax && rowYMax > heroYMin;
   });
   ```

3. Update `TagCheckboxes.tsx` to format rows with "H" suffix:
   ```typescript
   case 'row-too-dense':
   case 'single-photo-row':
     const formatted = rowSizes.map((size, i) => 
       result.rowHeroAdjacent[i] ? `${size}H` : `${size}`
     );
     return `${tag === 'row-too-dense' ? 'Row too dense' : 'Single-photo row'} ([${formatted.join(', ')}])`;
   ```

---

## Issue 3: Clarify "Uneven Sizes" Label

**Current**: `Uneven sizes (15.6×)` - unclear what 15.6× means

**Fix**: Make it explicit that this is the max-to-min area ratio:
```typescript
case 'uneven-sizes':
  return `Uneven sizes (max/min: ${largestToSmallestRatio.toFixed(1)}×)`;
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/test/layout/types.ts` | Add `rowHeroAdjacent: boolean[]` to `LayoutTestResult` |
| `src/test/layout/layoutAdapter.ts` | Calculate `rowHeroAdjacent` in `calculateMetrics` |
| `src/components/layout-rating/TagCheckboxes.tsx` | Fix percentage bug, format H-rows, clarify uneven sizes |

---

## Visual Result

Before:
```
Hero not prominent (10% vs 300%/300%/300%)
Row too dense ([5, 4, 4, 6, 5, 6, 5, 5, 5, 5])
Uneven sizes (15.6×)
```

After:
```
Hero not prominent (10% vs 3%/3%/3%)
Row too dense ([5H, 4H, 4H, 6, 5, 6, 5, 5, 5, 5])
Uneven sizes (max/min: 15.6×)
```


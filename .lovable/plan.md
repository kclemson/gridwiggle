

# Height Budget Implementation Plan

## Problem Statement

Hero layouts frequently violate shape constraints because the "below zone" (content rows after the hero unit) has no awareness of how tall the hero zone already is. This causes layouts that should be "Landscape" to produce portrait-ish results.

**Root cause**: `findBestRowSplit` uses `R = sqrt(S / A)` on just the remaining photos, without knowing the hero zone already consumed significant vertical space.

## Solution: Height Budgeting with Auto-Mode Handling

Add a "height budget" constraint that flows from the target shape through to the row partitioning algorithm. The budget tells the content rows "you have X pixels of vertical space remaining" so they can pack more densely when needed.

### Special Case: Auto Mode

For explicit shapes (landscape, portrait, square), the target aspect is the midpoint of bounds. For "auto" mode, we need a different approach since auto represents a wide range [0.67, 1.5]:

**Strategy: "Midpoint with Adaptive Adjustment"**
1. Start with auto's midpoint: ~1.08
2. If the hero zone alone already produces a more portrait aspect than the midpoint, blend toward the hero's natural aspect (don't fight an impossible battle)
3. This prevents negative/impossible budgets while still providing gentle guidance

```text
targetAspect = (0.67 + 1.5) / 2 = 1.08  // midpoint

heroAspectAlone = canvasWidth / heroBlock.height
// e.g., 1200 / 500 = 2.4 (very wide) or 1200 / 800 = 1.5 (square-ish)

if (heroAspectAlone < targetAspect) {
  // Hero is already taller than target - blend toward reality
  targetAspect = (heroAspectAlone + targetAspect) / 2
}
```

---

## Technical Changes

### File 1: `src/lib/heroLayout.ts`

**Location**: `generateBlockBasedHeroLayout()` function (~lines 1329-1345)

**Change**: After building the hero block, calculate height budget and pass to content block:

```typescript
// After heroBlock is built (line 1329)

// Calculate height budget for content rows
const [minAspect, maxAspect] = getAspectBounds(shape);
let targetAspect = (minAspect + maxAspect) / 2;

// For 'auto' mode: adapt if hero is already taller than target
if (shape === 'auto') {
  const heroAspectAlone = canvasWidth / heroBlock.height;
  if (heroAspectAlone < targetAspect) {
    // Hero is taller than midpoint - blend toward reality
    targetAspect = (heroAspectAlone + targetAspect) / 2;
  }
}

const targetTotalHeight = canvasWidth / targetAspect;
const budgetHeight = targetTotalHeight - heroBlock.height - gap;

// Pass budget to content block builder
const contentBlock = remaining.length > 0
  ? buildContentRowsBlock(
      remaining as PhotoDimension[],
      canvasWidth,
      gap,
      packPhotosIntoRegion,
      tuning.minPhotosPerRow,
      shape,
      budgetHeight  // NEW PARAMETER
    )
  : null;
```

---

### File 2: `src/lib/layoutBlocks.ts`

**Location**: `buildContentRowsBlock()` function (~lines 344-372)

**Change 1**: Update function signature to accept optional `maxHeight`:

```typescript
export function buildContentRowsBlock(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  packPhotosIntoRegion: (dims: PhotoDimension[], options: RegionPackOptions) => RegionPackResult,
  minPhotosPerRow: number = 2,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto',
  maxHeight?: number  // NEW: height budget from hero layout
): ContentRowsBlock | null {
```

**Change 2**: Pass `maxHeight` through to `packPhotosIntoRegion`:

```typescript
const result = packPhotosIntoRegion(photos, {
  width: canvasWidth,
  gap,
  offsetX: 0,
  offsetY: 0,
  minPhotosPerRow,
  shape,
  maxHeight,  // NEW: pass through budget
});
```

**Change 3**: Update the type annotation for `packPhotosIntoRegion` parameter to include `maxHeight`:

```typescript
packPhotosIntoRegion: (dims: PhotoDimension[], options: { 
  width: number; 
  gap: number; 
  offsetX: number; 
  offsetY: number; 
  minPhotosPerRow?: number; 
  shape?: 'auto' | 'landscape' | 'portrait' | 'square';
  maxHeight?: number;  // NEW
}) => { cells: CollageCell[]; achievedHeight: number; partition: PhotoDimension[][] },
```

---

### File 3: `src/lib/collageLayout.ts`

**Location 1**: `RegionPackOptions` interface (~lines 178-200)

**Change**: Add `maxHeight` field:

```typescript
export interface RegionPackOptions {
  width: number;
  gap: number;
  targetHeight?: number;
  tolerance?: number;
  offsetX?: number;
  offsetY?: number;
  shape?: CollageSettings['shape'];
  minPhotosPerRow?: number;
  maxHeight?: number;  // NEW: soft ceiling for total packed height
}
```

**Location 2**: `packPhotosIntoRegion()` function (find the call to `findBestRowSplit`)

**Change**: Pass `maxHeight` and `width`/`gap` to `findBestRowSplit`:

```typescript
const partition = findBestRowSplit(
  dims, 
  shape ?? 'auto', 
  false, 
  minPhotosPerRow,
  width,      // NEW: needed for height calculation
  gap,        // NEW: needed for height calculation
  maxHeight   // NEW: height budget
);
```

**Location 3**: `findBestRowSplit()` function (~lines 484-553)

**Change 1**: Update signature:

```typescript
function findBestRowSplit(
  dims: PhotoDimension[],
  shape: CollageSettings['shape'],
  randomize: boolean = false,
  minPhotosPerRow: number = 2,
  width: number = 1200,     // NEW: canvas width for height calc
  gap: number = 4,          // NEW: gap for height calc
  maxHeight?: number        // NEW: height budget (soft constraint)
): PhotoDimension[][] {
```

**Change 2**: Inside the partition scoring loop, add budget penalty:

```typescript
for (let numRows = minRows; numRows <= effectiveMaxRows; numRows++) {
  // ... existing partition generation code ...
  
  for (const partition of generatePartitions(workingDims, numRows)) {
    const score = scorePartition(partition, shape, width, minPhotosPerRow);
    
    // NEW: Apply height budget penalty
    if (maxHeight !== undefined) {
      const partitionHeight = calculatePartitionHeight(partition, width, gap);
      if (partitionHeight > maxHeight) {
        const overage = (partitionHeight - maxHeight) / maxHeight;
        // Quadratic penalty: increasingly bad as we exceed budget
        score.totalScore += 5.0 * overage * overage;
      }
    }
    
    insertIntoTopN(topScores, score, TOP_N);
  }
}
```

**Location 4**: Add helper function to calculate partition height:

```typescript
/**
 * Calculate the total height of a partition when packed at given width.
 * Each row height = width / sum(aspectRatios in row).
 */
function calculatePartitionHeight(
  partition: PhotoDimension[][],
  width: number,
  gap: number
): number {
  let totalHeight = 0;
  
  for (let i = 0; i < partition.length; i++) {
    const row = partition[i];
    const aspectSum = row.reduce((sum, p) => sum + p.aspectRatio, 0);
    const rowHeight = width / aspectSum;
    totalHeight += rowHeight;
    
    if (i < partition.length - 1) {
      totalHeight += gap;
    }
  }
  
  return totalHeight;
}
```

---

## Flow Diagram

```text
Before (shape-unaware):
========================
generateBlockBasedHeroLayout()
  └── buildHeroUnitBlock() → heroHeight = 500px
  └── buildContentRowsBlock(remaining)
        └── packPhotosIntoRegion()
              └── findBestRowSplit(4 photos)  
                    └── Uses R = sqrt(S/A) on just 4 photos
                    └── Returns 2 rows (~700px)
  └── stackBlocks() → 500 + 700 = 1200px → aspect 1.0 (WRONG!)


After (shape-aware via height budget):
======================================
generateBlockBasedHeroLayout()
  └── buildHeroUnitBlock() → heroHeight = 500px
  
  └── Calculate budget:
        targetAspect = 1.625 (landscape midpoint)
        targetHeight = 1200 / 1.625 = 738px
        budgetHeight = 738 - 500 - 4 = 234px
  
  └── buildContentRowsBlock(remaining, maxHeight=234px)
        └── packPhotosIntoRegion(maxHeight=234px)
              └── findBestRowSplit(4 photos, maxHeight=234px)
                    └── Scores 2-row partition (~700px) → HIGH PENALTY
                    └── Scores 1-row partition (~280px) → lower penalty
                    └── Returns 1 row
  
  └── stackBlocks() → 500 + 280 = 780px → aspect 1.54 (LANDSCAPE!)
```

---

## Auto Mode Behavior

| Hero Aspect Alone | Target Aspect Used | Effect |
|-------------------|-------------------|--------|
| 2.4 (very wide hero) | 1.08 (midpoint) | Generous budget for content |
| 1.5 (square-ish hero) | 1.08 (midpoint) | Moderate budget |
| 0.8 (tall hero) | 0.94 (blended) | Accepts tall layout, prevents impossible budget |
| 0.5 (very tall hero) | 0.79 (blended) | Graceful degradation |

The blending formula `(heroAspect + midpoint) / 2` ensures we never fight an impossible battle while still providing gentle guidance toward the center of auto's range.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| **Negative budget** | Budget is very small/negative = hero alone exceeds target. Content packs into 1 ultra-dense row (matches reference collage aesthetic). |
| **Extremely tight budget** | Soft penalty degrades gracefully. Algorithm finds "least bad" solution rather than hard failing. |
| **Portrait target** | Large budget = content spreads across many rows (expected behavior). |
| **Very few photos below** | 1-2 photos always fit in 1 row; budget rarely constrains. |

---

## Testing Checklist

After implementation, verify with:

| Test Case | Expected Behavior |
|-----------|------------------|
| 8 photos, 1 hero, landscape | Content → 1 row, final aspect > 1.25 |
| 50 photos, 1 hero, landscape | Content → 2-3 dense rows, final aspect > 1.25 |
| 12 photos, 1 hero, portrait | Content → 3-4 rows, final aspect < 0.8 |
| 8 photos, 1 hero, square | Content adjusts to hit ~1.0 aspect |
| 8 photos, 1 hero, auto | Content gets moderate budget, no extreme result |
| Very tall hero + auto | Budget adapts, doesn't fight impossible |

Use `/layout-rating` tool to generate batches and verify shape compliance improves.

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/lib/heroLayout.ts` | Calculate budget with auto-mode handling, pass to buildContentRowsBlock |
| `src/lib/layoutBlocks.ts` | Add `maxHeight` parameter, thread to packPhotosIntoRegion |
| `src/lib/collageLayout.ts` | Add `maxHeight` to RegionPackOptions, update findBestRowSplit signature, add budget penalty + height calculation helper |

## Estimated Scope

- ~80-100 lines of code changes across 3 files
- No new dependencies
- Backward compatible (maxHeight is optional)


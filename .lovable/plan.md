

# Fix Hero Prominence: Canvas-Level Area Check

## Problem

The `clamped` check we added works for row-level geometry issues, but doesn't prevent 1-row layouts where the hero ends up as a small fraction of the **total canvas area**.

**Current state (from your screenshot):**
- Hero AR: 2.27 (landscape)
- Config accepted: 1-row, 4 beside photos, heroWidthFraction: 0.34
- Hero Area: **~6%** of total canvas

The hero *looks* fine at the row level (it's 34% of the row width), but when you add 17 more photos below in full-width rows, the hero becomes a tiny 6% of the overall canvas.

## Root Cause

The `calculateOptimalHeroFraction` function returns `clamped: false` for this configuration because the **row-level geometry works**. But there's no check for **canvas-level prominence**.

## Solution: Add Minimum Hero Coverage Check

After building a hero unit block (and before accepting it), estimate what % of the final canvas the hero will occupy. Reject configurations where hero coverage is too low.

```text
┌─────────────────────────────────────────────────────────────┐
│   After building hero block:                                │
│                                                             │
│   1. Estimate total canvas height:                          │
│      - heroHeight + gap + remainingPhotosHeight             │
│                                                             │
│   2. Calculate estimated hero coverage:                     │
│      - heroArea / (canvasWidth × estimatedTotalHeight)      │
│                                                             │
│   3. Reject if coverage < minHeroCoverage (e.g., 8%)        │
└─────────────────────────────────────────────────────────────┘
```

## Technical Changes

### File 1: `src/types/collage.ts`

Add new tuning parameter:

```typescript
interface LayoutTuning {
  // ... existing fields ...
  
  /** Minimum hero area as % of total canvas (default 0.08 = 8%) */
  minHeroCoverage: number;
}

export const DEFAULT_TUNING: LayoutTuning = {
  // ... existing defaults ...
  minHeroCoverage: 0.08,  // 8% of canvas
};
```

### File 2: `src/lib/layoutBlocks.ts`

In `buildHeroUnitBlock`, after successfully building a hero unit but before returning, estimate canvas coverage:

```typescript
// After line 368 (after building successful hero unit)

// Estimate total canvas height to check hero coverage
const remainingCount = candidates.length - besidePhotos.length;
const avgRemainingAR = remainingCount > 0 
  ? candidates.slice(besideCount).reduce((s, p) => s + p.aspectRatio, 0) / remainingCount
  : 1.0;

// Estimate rows needed for remaining photos (rough: photosPerRow ≈ 3-4)
const estimatedRowsBelow = Math.max(0, Math.ceil(remainingCount / 3.5));
const estimatedRowHeight = canvasWidth / (3.5 * avgRemainingAR); // Approximate
const estimatedBelowHeight = estimatedRowsBelow * (estimatedRowHeight + gap);

const estimatedTotalHeight = scaledHeroHeight + gap + estimatedBelowHeight;
const estimatedHeroCoverage = (scaledHeroWidth * scaledHeroHeight) / 
                               (canvasWidth * estimatedTotalHeight);

// Check if hero will have sufficient canvas presence
const minHeroCoverage = options.minHeroCoverage ?? 0.08;
if (estimatedHeroCoverage < minHeroCoverage) {
  devLogger.log('layout', 'Config rejected', {
    rowCount,
    besideCount,
    estimatedHeroCoverage,
    reason: `hero coverage ${(estimatedHeroCoverage * 100).toFixed(1)}% < ${minHeroCoverage * 100}%`,
  });
  continue;
}
```

### File 3: `src/lib/heroLayout.ts`

Pass the new tuning parameter when calling `buildHeroUnitBlock`:

```typescript
// In generateBlockBasedHeroLayout, add to options:
{
  // ... existing options ...
  minHeroCoverage: tuning.minHeroCoverage,
}
```

## Expected Behavior

| Scenario | Photo Count | 1-Row Coverage | Result |
|----------|-------------|----------------|--------|
| 22 photos, 1-row, 4 beside | 22 | ~6% | **Rejected** → tries 2-row |
| 22 photos, 2-row, 6 beside | 22 | ~10-12% | Accepted |
| 8 photos, 1-row, 4 beside | 8 | ~20% | Accepted |

The 1-row mode will still work for smaller photo sets where the hero naturally takes up more canvas space, but will be rejected for large sets where the "below zone" would dwarf the hero.

## Why This Is Clean

1. **Uses existing pattern**: Same rejection-and-continue flow as scale tolerance
2. **Mathematically grounded**: Based on estimated canvas area, not arbitrary rules
3. **Tunable**: `minHeroCoverage` can be adjusted via debug panel
4. **Preserves variety**: 1-row still works when hero naturally dominates

## Files Changed

| File | Change |
|------|--------|
| `src/types/collage.ts` | Add `minHeroCoverage` to LayoutTuning |
| `src/lib/layoutBlocks.ts` | Add hero coverage estimation and rejection check |
| `src/lib/heroLayout.ts` | Pass `minHeroCoverage` option |


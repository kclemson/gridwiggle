
# Plan: Geometrically-Derived BesideCount Range + Randomized Row Count Selection

**Status: ✅ IMPLEMENTED**

## Overview

This plan addresses two sources of variety reduction in the layout engine:

1. **BesideCount range**: ~~Currently hardcoded to 0–12~~ → Now dynamically calculated from hero AR and photo count
2. **BelowRowCount selection**: ~~Always picks the middle~~ → Now picks randomly within valid range when `randomize=true`

Both issues compound to reduce the diversity of layouts the algorithm can discover.

---

## Part 1: Geometrically-Derived BesideCount Range

### Current Problem

```typescript
// region-search.ts, line 91
const maxBesidePhotos = Math.min(photos.length, 12); // Arbitrary cap
```

This ignores:
- **Hero shape**: A tall portrait hero (AR 0.6) could easily support 20+ photos beside it
- **Total photo count**: With 50 photos, exploring only 0–12 beside means we never try layouts where 30 photos go beside (which could be valid and interesting)
- **Canvas AR limits**: Wide heroes might only support 0–6 beside before violating canvas_maxAR

### Solution: Calculate Range from Geometry

Add a new function to `feasibility.ts` that computes valid bounds:

```typescript
export function calculateBesideCountRange(
  heroAR: number,
  totalContentCount: number,
  avgContentAR: number,
  normalizedGap: number,
  tuning: V3Tuning
): { minBeside: number; maxBeside: number }
```

#### Lower Bound (minBeside)

For most cases, `minBeside = 0` is valid (hero at top, all content below).

However, for very narrow heroes with many photos, we may need minimum beside to avoid violating `canvas_minAR`:

```text
If heroAR is small and contentCount is large:
  - All photos below → tall canvas → may exceed canvas_minAR
  - Need width from BESIDE to prevent this
  
minBeside ≈ 0 for most cases
minBeside > 0 when: heroAR < threshold AND contentCount > threshold
```

The formula estimates how many beside photos are needed to achieve enough width:

```text
requiredWidth = minAR × estimatedHeight
widthFromBeside = besideCount × avgContentAR / besideRows
minBeside ≈ (requiredWidth - heroAR) × besideRows / avgContentAR
```

#### Upper Bound (maxBeside)

Limited by three factors:

1. **Canvas width limit** (prevent too-wide):
   ```text
   heroRowWidth ≤ canvas_maxAR × minHeight
   heroAR + gap + besideWidth ≤ canvas_maxAR × (1 + 2×gap)
   besideWidth ≤ canvas_maxAR × (1 + 2×gap) - heroAR - gap
   
   maxBeside_width ≈ besideRows × (canvas_maxAR - heroAR) / avgContentAR
   ```

2. **Hero prominence** (hero must remain dominant):
   ```text
   heroArea / smallestBesideCell ≤ hero_maxToSmallest
   maxBeside_prominence derived from this constraint
   ```

3. **Physical limit**: Can't have more beside than total photos

```text
maxBeside = min(
  maxBeside_width,
  maxBeside_prominence,
  totalContentCount  // ALL photos beside is valid for portrait heroes
)
```

### Expected Impact

| Scenario | Before (0–12) | After (calculated) |
|----------|---------------|-------------------|
| 50 photos + portrait hero (AR 0.6) | Search 0–12 → many "too tall" failures | Search 0–40+ → finds wide layouts |
| 50 photos + landscape hero (AR 2.0) | Search 0–12 → some too wide | Search 0–8 → tighter, faster |
| 15 photos + portrait hero | Search 0–12 → might fail at 5 | Search 0–15 → explores all |

---

## Part 2: Randomized Row Count Selection

### Current Problem

```typescript
// normalized-pack.ts, line 322-323
// Choose middle of valid range for balance
return Math.max(minRows, Math.min(maxRows, Math.ceil((minRows + maxRows) / 2)));
```

This always picks the middle, which:
- Biases toward "average-looking" layouts
- Reduces variety across shuffles
- Never explores the edges of the valid range (which could be interesting)

### Solution: Sample Randomly Within Valid Range

When `randomize=true`, pick uniformly from `[minRows, maxRows]`:

```typescript
export function calculateBelowRowCount(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  heroAR: number,
  tuning: V3Tuning,
  randomize: boolean = false  // NEW parameter
): number {
  // ... existing constraint calculation ...
  
  const minRows = Math.max(1, minRowsByMaxAR, minRowsByCellSize);
  const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR, Math.ceil(n / 2)));
  
  if (randomize && minRows < maxRows) {
    // Uniform random selection within valid range
    return minRows + Math.floor(Math.random() * (maxRows - minRows + 1));
  }
  
  // Deterministic: middle of range (existing behavior)
  return Math.max(minRows, Math.min(maxRows, Math.ceil((minRows + maxRows) / 2)));
}
```

### Update Call Sites

In `region-search.ts`, pass the `randomize` flag through:

```typescript
const belowRowCount = calculateBelowRowCount(
  belowPhotos, 
  heroRowWidth, 
  normalizedGap,
  heroAR,
  tuning,
  randomize  // NEW: pass through
);
```

---

## Example: 15-Photo Portrait Hero Test Case

With the rejected layout from the screenshot (hero AR ≈ 0.6, 15 photos):

### Before (current algorithm)

- Search range: 0–12 beside
- Tries besideCount = 5 → narrow heroRowWidth → 10 photos squeeze into BELOW
- Bottom row has 7 tiny photos (area ≈ 0.01)
- Fails `hero_maxToSmallest` check (ratio 50x vs 45x limit)

### After (with this change)

- Calculated range: minBeside = 0, maxBeside = 15 (all photos could go beside)
- Explores besideCount = 12:
  - 12 photos beside in ~3 rows → wider heroRowWidth
  - Only 3 photos in BELOW → larger cells (area ≈ 0.06)
  - Passes all prominence checks
- Also explores besideCount = 15 (all beside, empty BELOW):
  - 15 photos in ~4 rows beside tall hero
  - Creates a landscape canvas with no BELOW region
  - Valid for portrait heroes

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/v3/feasibility.ts` | Add `calculateBesideCountRange()` function |
| `src/lib/v3/region-search.ts` | Use new function instead of hardcoded 0–12; pass `randomize` to `calculateBelowRowCount` |
| `src/lib/v3/normalized-pack.ts` | Add `randomize` parameter to `calculateBelowRowCount`; implement random selection |

---

## Technical Details

### calculateBesideCountRange Implementation

```typescript
export function calculateBesideCountRange(
  heroAR: number,
  totalContentCount: number,
  avgContentAR: number,
  normalizedGap: number,
  tuning: V3Tuning
): { minBeside: number; maxBeside: number } {
  // === Lower Bound ===
  // For narrow heroes with many photos, we may need beside width to avoid too-tall canvas
  let minBeside = 0;
  
  if (heroAR < 1.0 && totalContentCount > 10) {
    // Estimate: with 0 beside, how tall would canvas be?
    // belowHeight ≈ sqrt(totalContentCount × avgContentAR / heroAR)
    const estimatedBelowHeight = Math.sqrt(totalContentCount * avgContentAR / heroAR);
    const estimatedCanvasAR = heroAR / (1.0 + normalizedGap + estimatedBelowHeight);
    
    if (estimatedCanvasAR < tuning.canvas_minAR) {
      // Need wider canvas → need beside photos
      // Target: heroRowWidth such that canvasAR ≈ canvas_minAR
      // Approximate: add enough beside to double the width
      const maxBesideRows = 4;
      const widthNeeded = tuning.canvas_minAR * (1.0 + estimatedBelowHeight) - heroAR;
      minBeside = Math.ceil(widthNeeded * maxBesideRows / avgContentAR);
      minBeside = Math.max(0, Math.min(minBeside, totalContentCount - 1));
    }
  }
  
  // === Upper Bound ===
  // Limited by canvas_maxAR (prevent too-wide)
  const minBesideRows = 2; // Conservative: at least 2 rows beside
  const maxWidthFromBeside = tuning.canvas_maxAR * (1.0 + 2 * normalizedGap) - heroAR - normalizedGap;
  const maxBesideByWidth = Math.floor(maxWidthFromBeside * minBesideRows / avgContentAR);
  
  // Limited by prominence (hero must remain dominant)
  // heroArea / smallestCell >= hero_minProminence
  // With many beside photos, cells get smaller → eventually hero too dominant
  // This is actually a lower-bound-on-cell-size issue, handled by hero_maxToSmallest
  // For upper bound, we're more concerned with width
  
  // Physical limit: can't exceed total photos
  const maxBeside = Math.max(minBeside, Math.min(totalContentCount, maxBesideByWidth));
  
  return { minBeside, maxBeside };
}
```

### Empty BELOW Handling

The codebase already supports empty BELOW:
- `packToFillWidth` returns empty result for empty array (line 162)
- `calculateBelowRowCount` returns 1 for ≤1 photos (line 292)

One small addition: skip BELOW packing entirely when `belowPhotos.length === 0`:

```typescript
// In region-search.ts, after slicing
if (belowPhotos.length === 0) {
  // All photos beside, no BELOW region
  // Canvas height = heroRowHeight + borders only
  // ... validate and create assignment ...
}
```

---

## Validation

After implementation, the 15-photo portrait hero test case should:

1. **Explore higher besideCounts** (12, 13, 14, 15) that were previously blocked
2. **Find valid layouts** where BELOW has fewer, larger photos
3. **Produce variety** when shuffled (different besideCounts + different belowRowCounts)

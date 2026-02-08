

# Fix: Include BELOW Height in maxBeside Calculation + Enrich Soft Rejection Metadata

## Problem Summary

### Issue 1: Landscape Heroes Get maxBeside = 0 (Wrong)

With a landscape hero (AR 1.73) and 30 photos, the algorithm calculates `maxBeside = 0`, forcing all content below the hero and creating only "full-width top/bottom" layouts. This is incorrect — there's plenty of room for photos beside the hero.

**Root Cause:** The `calculateBesideCountRange` function (lines 226-243) calculates `maxBesideByWidth` assuming the canvas height is just the hero row plus borders:

```typescript
// Current broken logic
const minCanvasHeight = 1.0 + 2 * normalizedGap;  // ← Assumes NO BELOW photos!
const maxCanvasWidth = effectiveMaxAR * minCanvasHeight;  // ~2.4
const maxBesideWidth = maxCanvasWidth - heroAR - normalizedGap;  // ~0.6
const maxBesideByWidth = Math.floor(maxBesideWidth * 2 / avgContentAR);  // ~1 photo
```

With 30 photos, BELOW will add significant height (4+ rows), which would increase allowed canvas width proportionally. The current code ignores this.

### Issue 2: Soft Rejection Badge Missing Metadata

The soft rejection badge shows only basic info:
```
canvasAR: 0.46
allowed: 0.50 - 2.25
```

But hard rejections show detailed diagnostics (besideCount, belowConstraints, etc.). Soft rejections should show the same level of detail.

## Solution

### Fix 1: Height-Aware maxBeside Calculation

Replace the flat-height assumption with an iterative approach that estimates BELOW height for each potential besideCount:

```
For each testBeside from 0 to 15:
  1. belowCount = totalCount - testBeside
  2. estimatedBelowHeight = √(belowCount × avgAR / heroAR)
  3. canvasHeight = heroRow + gaps + estimatedBelowHeight
  4. maxCanvasWidth = canvas_maxAR × canvasHeight
  5. Check if testBeside fits within that width
  6. Track highest valid besideCount
```

This models the tradeoff: more photos beside → fewer photos below → shorter canvas → less width allowed.

### Fix 2: Enrich Soft Rejection Metadata

When soft rejections are created in `region-search.ts`, add the same diagnostic fields that hard rejections get:
- `besideCount`, `besideRowCount`, `belowRowCount`
- `belowConstraints` 
- `heroAR`, `canvasAR`

## Technical Changes

### `src/lib/v3/feasibility.ts`

**Replace lines 226-243** (upper bound calculation) with iterative height-aware logic:

```typescript
// === Upper Bound (maxBeside) ===

// Constraint 1: Canvas width limit (prevent too-wide)
// Key insight: BELOW adds height, which allows MORE width within AR limit
// Iterate to find where width limit kicks in

let maxBesideByWidth = 0;
const maxTestBeside = Math.min(totalContentCount, 15); // Reasonable search limit

for (let testBeside = 0; testBeside <= maxTestBeside; testBeside++) {
  const testBelowCount = totalContentCount - testBeside;
  
  // Estimate BELOW height geometrically
  // belowHeight ≈ √(belowCount × avgContentAR / width)
  // Use heroAR as width estimate (conservative - actual width may be wider)
  const estimatedBelowHeight = testBelowCount > 0
    ? Math.sqrt(testBelowCount * avgContentAR / heroAR)
    : 0;
  
  // Actual canvas height includes hero row + gap + below + borders
  const estimatedCanvasHeight = 1.0 + normalizedGap + estimatedBelowHeight + 2 * normalizedGap;
  
  // Width limit from this height
  const maxCanvasWidth = effectiveMaxAR * estimatedCanvasHeight;
  const maxHeroRowWidth = maxCanvasWidth - 2 * normalizedGap;
  
  // Available width for BESIDE (beside is stacked, so divide by row count)
  const maxBesideWidth = maxHeroRowWidth - heroAR - normalizedGap;
  
  // How many photos can fit in that width? (estimate rows based on beside count)
  const assumedBesideRows = testBeside > 0 ? Math.max(2, Math.ceil(testBeside / 4)) : 1;
  const fitsInWidth = maxBesideWidth > 0
    ? Math.floor(maxBesideWidth * assumedBesideRows / avgContentAR)
    : 0;
  
  // If this besideCount fits, update max
  if (testBeside <= fitsInWidth) {
    maxBesideByWidth = testBeside;
  }
}
```

### `src/lib/v3/region-search.ts`

**Enrich soft rejection details in two places:**

1. **Lines 183-204** (no-BESIDE case): Add diagnostic fields to `softRejectionNoBeside`:
```typescript
if (canvasAR < effectiveMinARNoBeside - AR_EPSILON) {
  softRejectionNoBeside = {
    reason: 'canvas_too_tall',
    details: { 
      canvasAR: +canvasAR.toFixed(2), 
      allowed: `${effectiveMinARNoBeside.toFixed(2)} - ${effectiveMaxARNoBeside.toFixed(2)}`,
      besideCount: 0,
      besideRowCount: 0,
      belowRowCount,
      belowConstraints: belowRowResult.constraints,
      heroAR: +heroAR.toFixed(2),
    },
  };
  // ... rest of logging
}
```

2. **Lines 310-334** (with-BESIDE case): Add diagnostic fields to `softRejection`:
```typescript
if (canvasAR < effectiveMinAR - AR_EPSILON) {
  softRejection = {
    reason: 'canvas_too_tall',
    details: { 
      canvasAR: +canvasAR.toFixed(2), 
      allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}`,
      besideCount,
      besideRowCount,
      belowRowCount,
      belowConstraints: belowRowResult.constraints,
      heroAR: +heroAR.toFixed(2),
    },
  };
  // ... rest of logging
}
```

## Expected Results

### Before (Your Case: heroAR 1.73, 30 photos)
- `maxBeside: 0`
- Only full-width hero layouts
- Search range: `0 to 0 beside photos`

### After
- `maxBeside: ~8-12` (depending on exact photo mix)
- Varied layouts with content beside hero
- Search range: `0 to 10+ beside photos`

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/feasibility.ts` | Replace flat-height calculation with iterative height-aware loop |
| `src/lib/v3/region-search.ts` | Add diagnostic fields to soft rejection details in both no-BESIDE and with-BESIDE cases |

## Testing

1. Upload 30+ photos with a landscape hero (AR > 1.5)
2. Generate layouts and verify variety (hero sometimes has content beside it)
3. Verify soft rejection badge shows full diagnostic details (same as hard rejection)
4. Verify portrait heroes still work correctly


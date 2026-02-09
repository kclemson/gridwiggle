

# Surgical Fix: Remove the Cell Size Pre-Filter

## The Problem

For 46 photos with landscape hero (AR 1.755), the `calculateBelowRowCount` function produces:
- `minRows = 8` (dominated by `minRowsByCellSize`)
- `maxRows = 8` (capped by minRows!)

This forces exactly 8 rows in BELOW, which at `targetWidth = 1.755` creates an extremely tall canvas (AR ~0.6-0.7).

## Root Cause

The `minRowsByCellSize` constraint (lines 345-352 in `normalized-pack.ts`) is:
1. **Redundant**: The `hero_maxToSmallest` constraint is already validated post-pack in `intersection.ts`
2. **Overly conservative**: The formula uses `n²` which explodes for large photo counts
3. **Ignores BESIDE width**: When calculating for `besideCount=0`, it doesn't account for the fact that other configurations HAVE beside photos (and thus wider targetWidth)

### The Formula

```typescript
minRowsByCellSize = Math.ceil(
  Math.sqrt(heroAR * n * n * meanAR * meanAR / 
    (effectiveMinAR * targetWidth * targetWidth * tuning.hero_maxToSmallest))
);
```

For 45 photos at width 1.755:
- This produces `minRowsByCellSize ≈ 7-8`
- This completely constrains the row count, eliminating layout variety

## The Fix: Remove `minRowsByCellSize` Entirely

Since `hero_maxToSmallest` is validated post-pack with actual cell sizes (not estimates), this pre-filter is doing nothing but eliminating valid configurations.

### File: `src/lib/v3/normalized-pack.ts`

```typescript
// BEFORE (lines 343-356):
// === Constraint 3: Prevent tiny cells (hero_maxToSmallest) ===
let minRowsByCellSize = 1;
if (heroAR > 0) {
  const effectiveMinAR = minAR;
  minRowsByCellSize = Math.ceil(
    Math.sqrt(heroAR * n * n * meanAR * meanAR / 
      (effectiveMinAR * targetWidth * targetWidth * tuning.hero_maxToSmallest))
  );
}

// === Combine constraints ===
const minRows = Math.max(1, minRowsByMaxAR, minRowsByCellSize);
const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR));
```

```typescript
// AFTER:
// Note: hero_maxToSmallest is validated post-pack in intersection.ts
// Removing pre-filter as it's redundant and overly conservative for large photo counts

// === Combine constraints ===
const minRows = Math.max(1, minRowsByMaxAR);  // Removed minRowsByCellSize
const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR));
```

Also update the return type to remove the now-unused constraint:

```typescript
constraints: {
  maxRowsByMinAR,
  minRowsByMaxAR,
  // minRowsByCellSize removed - validated post-pack instead
  targetWidth,
}
```

## Why This Is Safe

1. **Actual validation exists**: `intersection.ts` checks `hero_maxToSmallest` against real packed cell sizes
2. **Pre-filters are estimates**: They can't account for actual packing results
3. **Soft rejections work**: Even if a layout violates constraints, it's returned with a penalty

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Row count range (45 photos) | 8–8 (no choice) | 5–12+ (variety) |
| Canvas AR range | 0.48–0.99 | 0.50–1.50+ |
| Landscape layouts | 1/10 (10%) | 3-4/10 (30-40%) |

## Files to Change

| File | Change |
|------|--------|
| `src/lib/v3/normalized-pack.ts` | Remove `minRowsByCellSize` from calculation (lines 343-353) and from return constraints |

## Technical Detail

The `minRowsByCellSize` formula has `n²` in the numerator:
```
heroAR × n² × meanAR² / (minAR × targetWidth² × hero_maxToSmallest)
```

For 45 photos: `n² = 2025`

This `n²` term causes the constraint to explode for large photo sets, completely dominating over geometric constraints (`minRowsByMaxAR` which is only `O(n)`). Removing it lets the actual AR-based constraints drive row selection.


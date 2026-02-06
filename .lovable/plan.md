

# Fix: Row Count Mismatch Between Split Search and Final Evaluation

## Summary

The split search correctly calculates how many rows are needed for the BELOW region, but the final evaluation throws that away and recalculates with a naive heuristic. This causes valid layouts to be rejected.

---

## Design Intent

**What problem are we solving?**  
Hero layouts are failing because the BELOW row count used in final packing differs from what was validated during split search. The search finds "2 rows works", but final eval uses "5 rows" and the layout becomes too tall.

**What will users experience?**  
Hero layouts will start working again. The layouts will match what the search algorithm validated as acceptable.

---

## The Bug

### Current Flow (Broken)

```text
findBestSplit():
  for each besideCount:
    for each besideRowCount:
      belowRowCount = calculateBelowRowCount(...)  // Smart: respects canvas AR
      pack and validate...
      save best split
  return { besidePhotos, belowPhotos, besideRowCount }  // Missing belowRowCount!

evaluateNormalizedProposal():
  splitResult = findBestSplit(...)
  besideResult = packToFillHeight(..., splitResult.besideRowCount)
  belowRowCount = calculateOptimalBelowRowCount(...)  // Naive: ceil(n/4)
  belowResult = packToFillWidth(..., belowRowCount)
  // Layout rejected because wrong row count makes it too tall
```

### Example from Debug Logs

With 20 photos going to BELOW and heroRowWidth ~2.14:

| Function | Row Count | Canvas AR | Valid? |
|----------|-----------|-----------|--------|
| `calculateBelowRowCount` (search) | 2-3 | 0.8-1.2 | Yes |
| `calculateOptimalBelowRowCount` (eval) | 5 | 0.55 | No (below 0.7 min) |

---

## The Fix

Pass the validated `belowRowCount` from split search to final evaluation.

### Fixed Flow

```text
findBestSplit():
  for each besideCount:
    for each besideRowCount:
      belowRowCount = calculateBelowRowCount(...)
      pack and validate...
      save best split with belowRowCount
  return { besidePhotos, belowPhotos, besideRowCount, belowRowCount }  // Now includes it!

evaluateNormalizedProposal():
  splitResult = findBestSplit(...)
  besideResult = packToFillHeight(..., splitResult.besideRowCount)
  belowResult = packToFillWidth(..., splitResult.belowRowCount)  // Use stored value
  // Layout matches what was validated
```

---

## File Changes

### 1. `src/lib/v3/types.ts` - Add belowRowCount to SplitResult

```typescript
export interface SplitResult {
  besidePhotos: PhotoDimension[];
  belowPhotos: PhotoDimension[];
  besideRowCount: number;
  belowRowCount: number;  // ADD THIS
  score: number;
}
```

### 2. `src/lib/v3/split-search.ts` - Store belowRowCount in result

In `findBestSplit`, update the best split storage:

```typescript
// Current (line ~70):
if (bestSplit === null || score > bestSplit.score) {
  bestSplit = {
    besidePhotos,
    belowPhotos,
    besideRowCount,
    score,
  };
}

// Fixed:
if (bestSplit === null || score > bestSplit.score) {
  bestSplit = {
    besidePhotos,
    belowPhotos,
    besideRowCount,
    belowRowCount,  // ADD THIS
    score,
  };
}
```

### 3. `src/lib/v3/intersection.ts` - Use stored belowRowCount

In `evaluateNormalizedProposal`, remove the naive calculation and use the stored value:

```typescript
// Current (lines ~115-122):
const belowRowCount = calculateOptimalBelowRowCount(
  splitResult.belowPhotos,
  heroRowWidth,
  estimatedNormalizedGap,
  tuning
);

// Fixed:
const belowRowCount = splitResult.belowRowCount;
```

Also delete the `calculateOptimalBelowRowCount` helper function (lines ~190-199) since it's no longer needed.

---

## Technical Notes

### Why the naive heuristic fails

`calculateOptimalBelowRowCount` uses:
```typescript
if (n <= 6) return 2;
if (n <= 12) return 3;
return Math.min(n, Math.ceil(n / 4));
```

For 20 photos: `ceil(20/4) = 5 rows`

But `calculateBelowRowCount` in split-search uses the actual geometry:
```typescript
// Estimates based on total AR sum and target canvas AR
// For 20 photos with mixed ARs at width 2.14, calculates 2-3 rows needed
```

### No behavioral change to valid cases

This fix only affects the data flow. The split search already validated the configuration works - we're just ensuring the final evaluation uses the same parameters.

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Add `belowRowCount` to `SplitResult` interface |
| `src/lib/v3/split-search.ts` | Store `belowRowCount` in the returned split result |
| `src/lib/v3/intersection.ts` | Use `splitResult.belowRowCount` instead of recalculating; delete unused helper |

---

## Result

**Before**: Split search finds valid 2-row config, final eval uses 5 rows, layout rejected

**After**: Split search finds valid 2-row config, final eval uses 2 rows, layout accepted


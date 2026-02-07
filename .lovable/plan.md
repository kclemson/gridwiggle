
# Fix: Prominence Rejection in Split Search

## Root Cause

You correctly identified the nuance - BESIDE photos are packed into a region with height 1.0, but **multiple rows** within that region result in row heights less than 1.0.

**However**, the split search allows `besideRowCount = 1`, which means all BESIDE photos share the hero's height (1.0). When a wide content photo (e.g., AR = 1.78) is packed alone or in a single row, its area exceeds a portrait hero's area (e.g., AR = 0.75), causing prominence < 1.0.

### The Math

- Hero: AR = 0.75, area = 0.75 × 1.0 = **0.75**
- Wide content photo in 1-row BESIDE: AR = 1.78, area = 1.78 × 1.0 = **1.78**
- Prominence ratio = 0.75 / 1.78 = **0.42** → rejected (needs ≥ 1.3)

### Where the Bug Lives

`findBestSplit` uses `scoreSplit` which applies a **soft penalty** for low prominence, but doesn't discard the split. If no other splits work, this one gets selected and later rejected by `validateProminence` in the final validation.

---

## The Fix

Reject invalid splits **during split search** rather than letting them through only to fail later. This is "fail early" validation.

### Changes to `src/lib/v3/split-search.ts`

In the split search loop, after packing BESIDE and BELOW, check prominence **before** adding to `validSplits`:

```text
// After packing both regions, before adding to validSplits:

// Calculate actual cell areas from packed results
const allCellAreas = [
  ...besideResult.cells.map(c => c.width * c.height),
  ...belowResult.cells.map(c => c.width * c.height),
];

// Hero area in normalized space
const heroArea = heroAR * 1.0;

// Check prominence before accepting this split
const maxContentArea = Math.max(...allCellAreas, 0);
const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;

if (prominenceRatio < tuning.hero_minProminence) {
  // Log and skip - don't let this through to final validation
  devLogger.log('v3-split', 'Split rejected: prominence too low', {
    besideCount,
    besideRowCount,
    prominenceRatio: prominenceRatio.toFixed(2),
    required: tuning.hero_minProminence,
  });
  continue;
}
```

### Why This Works

By checking prominence at the **split level**, we:
1. Reject geometrically invalid configurations immediately
2. Give the search more opportunities to find valid alternatives (different row counts, different splits)
3. Ensure that if `findBestSplit` returns a split, it's already prominence-valid
4. Reduce wasted computation on configurations doomed to fail

### Alternative Considered: Minimum Row Count

We could also set `minRows` based on prominence requirements, but that's harder to compute accurately. The direct check is simpler and more robust.

---

## Summary

| File | Change |
|------|--------|
| `src/lib/v3/split-search.ts` | Add prominence validation inside the search loop before adding to `validSplits` |

This is a ~15-line addition that moves the prominence check earlier in the pipeline, preventing the "passes split search, fails final validation" scenario you're seeing in production.

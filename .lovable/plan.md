
# Fix: Remove Overly Conservative Canvas AR Feasibility Check

## The Problem

The layout engine is rejecting **nearly all beside configurations** for large photo sets (46 photos) because of a flawed feasibility check in `canBesideCountMeetCanvasAR`.

### Evidence from Captures (46 photos, heroAR 1.755)

| Metric | Value |
|--------|-------|
| `canvas_ar_infeasible_for_besidecount` rejections | 114-116 per layout |
| Valid candidates | Only `besideCount=0` passes |
| Final Canvas AR | 0.31-0.37 (extreme portraits) |

### Root Cause: The Check Ignores BELOW Height

```text
File: src/lib/v3/feasibility.ts, lines 139-152

Current logic:
  canvasWidth = heroAR + gap + besideWidth + 2*gap
  bestCaseAR = canvasWidth / (1.0 + 2 * normalizedGap)  ← ONLY hero row height
  if bestCaseAR > maxAR * 1.1 → reject
```

**The bug**: The denominator `(1.0 + 2 * normalizedGap)` is the height of just the hero row, ignoring BELOW region entirely.

### Walkthrough with Numbers

For `besideCount = 10` with 46 photos (36 go BELOW):

| Step | Calculation | Value |
|------|-------------|-------|
| sumBesideAR | 10 × 1.14 | 11.4 |
| maxRows | min(10, 6) | 6 |
| minBesideWidth | 11.4 / 6 | 1.9 |
| minHeroRowWidth | 1.755 + 0.008 + 1.9 | 3.66 |
| canvasWidth | 3.66 + 0.016 | 3.68 |
| **bestCaseAR** | 3.68 / 1.016 | **3.62** |
| threshold | 2.25 × 1.1 | 2.475 |
| Result | 3.62 > 2.475 | **REJECTED** |

But with 36 BELOW photos, actual height would be ~4-5, giving actual AR ~0.8-1.0 → **should be valid!**

## The Fix

Remove this check entirely. It duplicates the canvas AR validation that already exists in `region-search.ts` (lines 370-422), which correctly includes BELOW height.

### Implementation

**File: `src/lib/v3/feasibility.ts`**

Replace lines 139-154:

```typescript
// Before:
// No BELOW photos or no height needed → use original check
// Use effective canvas AR bounds (relaxed for low photo counts)
const effectiveMaxAR = getEffectiveCanvasMaxAR(totalContentCount, tuning);
const bestCaseAR = canvasWidth / (1.0 + 2 * normalizedGap);
const feasible = bestCaseAR <= effectiveMaxAR * 1.1;

if (!feasible) {
  devLogger.log('feasibility', 'Canvas AR infeasible for besideCount', {
    besideCount: besidePhotos.length,
    minHeroRowWidth: minHeroRowWidth.toFixed(2),
    bestCaseAR: bestCaseAR.toFixed(2),
    maxAR: effectiveMaxAR,
  });
}

return { feasible, minHeroRowWidth };
```

```typescript
// After:
// Always return feasible - let region-search.ts validate canvas AR
// with full knowledge of BELOW height (accurate vs. this estimate)
return { feasible: true, minHeroRowWidth };
```

## Why This is Safe

1. **Canvas AR is already validated in region-search.ts** (lines 370-422) after actual packing, with correct BELOW height
2. **Soft rejections handle edge cases** - layouts outside ideal AR bounds are penalized in scoring but still returned
3. **No new code paths** - just removing a redundant, overly-conservative filter

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Feasibility rejections (46 photos) | 114-116 | ~0-5 |
| Valid candidates | ~1 (besideCount=0) | ~30-44 |
| Canvas AR range | 0.31-0.37 | **0.50-1.50** |
| Landscape layouts (AR > 1.0) | 0% | ~15-30% |

## Files Changed

| File | Change |
|------|--------|
| `src/lib/v3/feasibility.ts` | Remove the overly-conservative `bestCaseAR` check (lines 139-152) |

## Test Verification

After this fix:
1. Run 10 shuffles on the 46-photo set in V3Test
2. Verify `canvas_ar_infeasible_for_besidecount` rejections drop to near-zero
3. Verify Canvas AR distribution widens (some layouts with AR > 0.8, some > 1.0)
4. Export new captures to confirm improvement in UI

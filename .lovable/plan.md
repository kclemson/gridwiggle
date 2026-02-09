

# Root Cause: Inverted Feasibility Check Rejecting All Landscape Configurations

## Problem Summary

Your capture data shows that for the 46-photo set:
- Canvas AR range: **0.32–0.63** (all extreme portraits)
- `canvas_ar_infeasible_(below_too_short)` rejections: **32–39 per layout** (out of ~42 checks)

The engine is systematically rejecting every configuration that could produce a wider canvas.

## Root Cause: The Feasibility Check Logic is Inverted

In `src/lib/v3/feasibility.ts`, the function `canBesideCountMeetCanvasAR` (lines 109–172) has a flawed premise:

```text
Current logic:
1. For high besideCount → wider heroRowWidth
2. Calculate requiredBelowHeight to meet canvas_maxAR
3. Estimate achievableBelowHeight from remaining photos
4. If achievable < required × 0.8 → reject as "BELOW too short"
```

**The bug:** This check is designed to prevent "too-wide" canvases by requiring BELOW to add height. But for high-beside configurations:
- Fewer photos go to BELOW → less achievable height
- The check fails → configuration rejected
- **Result:** All landscape-capable configurations are pruned before they're ever tried

## Walkthrough with Actual Numbers

**Input:** 46 photos, heroAR=1.755, avgAR=1.14, normalizedGap=0.003

For `besideCount = 30` (trying to make a wide canvas):

| Step | Value |
|------|-------|
| belowCount | 15 |
| sumBesideAR | 30 × 1.14 = 34.2 |
| maxRows | 4 (**hardcoded**) |
| minBesideWidth | 34.2 / 4 = 8.55 |
| minHeroRowWidth | 1.755 + 0.003 + 8.55 ≈ **10.3** |
| requiredTotalHeight | 10.3 / 2.25 = 4.58 |
| requiredBelowHeight | 4.58 - 1.01 = **3.57** |
| estimatedBelowHeight | √(15 × 1.14 / 10.3) = **1.29** |
| Check | 1.29 >= 3.57 × 0.8 = 2.86? **FAILS** |

The check rejects `besideCount=30` because BELOW can't produce enough height to "prevent" a wide canvas. But we **want** a wide canvas!

## Additional Hardcoded Issue: `maxRows = 4`

Line 123: `const maxRows = Math.min(besidePhotos.length, 4);`

This limits the BESIDE region to at most 4 rows when estimating width. For 30 photos beside, this produces an unrealistically wide width estimate (8.55 instead of a more realistic 4-5 with 6-7 rows), making the rejection even more aggressive.

## Why Recent Changes Made It Worse

The recent changes (randomized search order, removed 15-cap on besideCount) allowed the engine to *try* higher besideCount values. But this feasibility check rejects them all before packing is attempted. So we expanded the search space, but the feasibility filter just rejects more candidates.

## The Fix

### Option A: Remove the Check Entirely (Simplest)

The check is over-conservative. The actual packing + canvas AR validation in `region-search.ts` already handles this correctly. This feasibility check is a premature optimization that's blocking valid configurations.

**File:** `src/lib/v3/feasibility.ts`

```typescript
// Before (lines 136-154):
if (belowCount > 0 && requiredBelowHeight > 0) {
  const estimatedBelowHeight = Math.sqrt(belowCount * avgContentAR / minHeroRowWidth);
  const feasible = estimatedBelowHeight >= requiredBelowHeight * 0.8;
  if (!feasible) { /* log and reject */ }
  return { feasible, minHeroRowWidth };
}

// After: Remove this entire block, always return feasible
```

### Option B: Invert the Check Purpose (More Surgical)

If we want to keep some pre-filtering, change the check to reject configurations that would be "too tall" (portrait) rather than "too wide" (landscape).

### Option C: Remove the 80% Margin

At minimum, remove the `* 0.8` multiplier which makes the check overly conservative.

## Expected Impact

For the 46-photo set with landscape hero (AR 1.755):

| Metric | Before | After |
|--------|--------|-------|
| Feasibility rejections | 32-39 | ~5-10 |
| Valid configurations | ~4 | ~30+ |
| Canvas AR range | 0.32–0.63 | **0.50–1.50+** |
| Layouts with AR > 1.0 | 0% | ~20-40% |

## Files to Change

| File | Change |
|------|--------|
| `src/lib/v3/feasibility.ts` | Remove/fix `canBesideCountMeetCanvasAR` logic (lines 136-154) |
| `src/lib/v3/feasibility.ts` | Optionally: change `maxRows = 4` to `maxRows = 6` (line 123) |

## Why This Fix Doesn't Require Architectural Decisions

This is not about choosing a new canvas AR policy. The existing soft-rejection system already handles canvas AR limits correctly in `region-search.ts`. The problem is that a redundant feasibility check is prematurely blocking valid candidates before they can be evaluated.

Removing this check restores the intended behavior: let the engine explore the full search space, then score/select the best valid configuration.


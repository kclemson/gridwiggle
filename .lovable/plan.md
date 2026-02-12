

# Fix: Stale Region 1 Offset Causing Row Gap in Dual-Hero Layouts

## Problem
In diagonal-corners dual-hero layouts, a visible gap appears between the top hero section and the middle band. This is caused by Region 1 (middle band) using a stale y-offset from the topology function, which was computed with the **unscaled** hero height (`hH1`). After uniform row scaling, Hero 1's height becomes `scaledHH1` (larger), but Region 1's offset is never updated -- leaving a gap of `(scaledHH1 - hH1)` pixels.

## Root Cause

The topology function `diagonalCornersTopology` sets Region 1's offset to `{ x: gap, y: gap + hH1 + gap }`. After row scaling, `hH1` grows to `scaledHH1`, but line 684 in `v4/index.ts` (and line 735 in the worker) still use the original topology offset.

Region 2's offset IS correctly recalculated (line 769 / 820), but Region 1's is not.

## Fix

Both files need a one-line update: after scaling row 1, update Region 1's offset.y to use `scaledHH1` before packing it.

### File 1: `src/lib/v4/index.ts` (line ~758)

Before packing Region 1, update its offset to account for scaled row 1 height:

```
// Currently (line 758):
region1 = {
  ...region1,
  targetDimension: canonicalRowWidth,
};

// Fix:
region1 = {
  ...region1,
  targetDimension: canonicalRowWidth,
  offset: { x: normalizedGap, y: normalizedGap + scaledHH1 + normalizedGap },
};
```

### File 2: `src/workers/layoutWorker.ts` (line ~809)

Same fix:

```
// Currently (line 809):
region1 = {
  ...region1,
  targetDimension: canonicalRowWidth,
};

// Fix:
region1 = {
  ...region1,
  targetDimension: canonicalRowWidth,
  offset: { x: normalizedGap, y: normalizedGap + scaledHH1 + normalizedGap },
};
```

## What does NOT change
- Topology functions (the initial offset is fine as a starting point)
- Region 0 or Region 2 handling
- Scoring, scaling logic, or candidate selection
- Single-hero paths



# Fix Overlapping Dual Heroes

## Problem

When two heroes are placed using dual templates, their combined dimensions can exceed the canvas, causing overlap. In the screenshot: side-by-side with two wide landscape heroes (AR ~1.9) on a near-square canvas at 52% total area -- each hero is wide enough that they overlap in the middle.

## Root Cause

`placeDualHeroes` positions heroes at opposite edges without checking whether they collide. For side-by-side: Hero 1 starts at x=0, Hero 2 ends at x=1, but `d1.w + d2.w` can exceed 1.0.

## Fix

Add an overlap check in `generateHeroPlacement` for dual heroes. After computing dims and placing rects, detect overlap and **shrink heroes proportionally** until they no longer collide, maintaining their aspect ratios.

Specifically, for each template:
- **side-by-side**: if `d1.w + d2.w > 1`, scale both widths (and heights to preserve AR) so they sum to at most ~0.95 (leaving a small gap)
- **top-bottom**: if `d1.h + d2.h > 1`, scale both heights (and widths) similarly
- **diagonal-corners**: check for 2D rect intersection and scale down if overlapping

## Technical Details

### File: `src/test/layout/heroFractionGenerator.ts`

Add a helper function `fixDualOverlap` called after `placeDualHeroes` that:

1. For `side-by-side`: checks if `d1.w + d2.w > maxSum` (where `maxSum = 0.95`). If so, computes `scale = maxSum / (d1.w + d2.w)` and multiplies both heroes' w and h by `scale`, then re-centers vertically.

2. For `top-bottom`: same logic but on the height axis. Checks `d1.h + d2.h > 0.95` and scales accordingly.

3. For `diagonal-corners`: checks actual rectangle intersection (AABB overlap test). If overlapping, uniformly scale both heroes down until no overlap, with a minimum gap.

After fixing dims, recalculate `actualAreaFraction` from the corrected rects.

No other files change.


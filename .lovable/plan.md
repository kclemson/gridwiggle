

# Fix: Capture Last Rejected Pack in Region Search

## The Problem

When `findValidRegionAssignment` returns null and layout generation fails, there's often a "last rejected pack" that DID generate cells - we just didn't save it for visualization. Currently we `continue` past these rejections without preserving the cell data.

Looking at your screenshot, the sequence was:
1. `besideCount:0` rejected (canvas AR 0.51) - **cells existed**
2. `besideCount:1` rejected (canvas AR 0.53) - **cells existed**  
3. `besideCount:3` rejected (prominence 0.41) - **cells existed**
4. `besideCount:4` failed feasibility check - no packing attempted

The cells from `besideCount:3` were the last generated layout, but we threw them away.

## The Fix

Track the "last rejected pack" during the search loop, and return it as optional metadata when no valid assignment is found.

### Step 1: Extend Return Type

Add an optional `lastRejectedPack` field to the return type:

```typescript
interface RejectedPack {
  cells: { photoId: string; x: number; y: number; width: number; height: number }[];
  canvasWidth: number;
  canvasHeight: number;
  reason: string;
  details: Record<string, unknown>;
}

// findValidRegionAssignment returns:
// - RegionAssignment (success)
// - null with lastRejectedPack (all packs rejected)
// - null without lastRejectedPack (feasibility failures only)
```

### Step 2: Track Last Rejected Pack in Search Loop

In `findValidRegionAssignment`, before each `continue` that happens **after packing**, save the cells:

```typescript
// After canvas AR check fails (post-pack)
if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
  lastRejectedPack = {
    cells: buildCells(heroAR, besideResult, belowResult),
    canvasWidth: normalizedWidthWithBorder,
    canvasHeight: normalizedHeightWithBorder,
    reason: canvasAR < tuning.canvas_minAR ? 'canvas_too_tall' : 'canvas_too_wide',
    details: { canvasAR, besideCount, belowRowCount },
  };
  continue;
}

// After prominence check fails (post-pack)
if (prominenceRatio < tuning.hero_minProminence) {
  lastRejectedPack = {
    cells: buildCells(heroAR, besideResult, belowResult),
    canvasWidth: normalizedWidthWithBorder,
    canvasHeight: normalizedHeightWithBorder,
    reason: 'prominence_too_low',
    details: { prominenceRatio, required: tuning.hero_minProminence, besideCount },
  };
  continue;
}
```

### Step 3: Return Last Rejected Pack

Modify the null return to include the last rejected pack:

```typescript
if (validRegionAssignments.length === 0) {
  devLogger.warn('region-reject', 'No valid assignment found', {
    hasLastRejected: lastRejectedPack !== null,
  });
  return { assignment: null, lastRejectedPack };
}
```

### Step 4: Capture in intersection.ts

Update the caller to check for `lastRejectedPack` and call `setRejectedLayout`:

```typescript
const regionResult = findValidRegionAssignment(...);

if (!regionResult.assignment) {
  if (regionResult.lastRejectedPack) {
    setRejectedLayout({
      cells: regionResult.lastRejectedPack.cells,
      canvasWidth: regionResult.lastRejectedPack.canvasWidth,
      canvasHeight: regionResult.lastRejectedPack.canvasHeight,
      reason: regionResult.lastRejectedPack.reason,
      details: regionResult.lastRejectedPack.details,
      timestamp: Date.now(),
    });
  }
  devLogger.warn('layout-reject', 'No valid region assignment', {...});
  return null;
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/v3/region-search.ts` | Add `RejectedPack` type, track last rejected pack in search loop, return it when no valid assignment found |
| `src/lib/v3/intersection.ts` | Handle new return shape, call `setRejectedLayout` when `lastRejectedPack` exists |

## What This Does NOT Do

- No "best effort" fake layouts - we only capture packs that were actually generated
- No masking of underlying problems - the rejection reason and details are preserved
- No changes to scoring or balance logic - we'll discuss that separately



# Remove targetAspect from Auto Mode Flow

## Problem Identified

You're right - we previously decided that `minPhotosPerRow` should be the sole shape control lever. But the current code still has `targetAspect` influencing layouts through hardcoded defaults:

1. **`buildContentRowsBlock`** passes `isLandscape: true` to `packPhotosIntoRegion`
2. **`packPhotosIntoRegion`** (line 501) defaults to `isLandscape ? 1.5 : 0.75` when no `targetAspect` is provided
3. **`scorePartition`** penalizes layouts that deviate from this 1.5 target via `aspectDiff * 2.0`

Result: Even with `minPhotosPerRow` randomization, the algorithm optimizes toward 1.5 aspect ratio.

## Solution

Remove `targetAspect` influence when in auto mode (no explicit shape target):

### Change 1: Update `scorePartition` to handle undefined target

When `targetAspect` is `undefined`, skip the aspect penalty entirely:

```typescript
// src/lib/collageLayout.ts - scorePartition
function scorePartition(
  partition: PhotoDimension[][],
  targetAspect: number | undefined,  // Change to optional
  isLandscape: boolean,
  baseWidth: number = 1200,
  minPhotosPerRow: number = 2
): PartitionScore {
  // ...existing calculations...
  
  // Only penalize aspect deviation when we have a target
  const aspectDiff = targetAspect !== undefined 
    ? Math.abs(resultAspect - targetAspect) / targetAspect 
    : 0;
  
  // Only apply direction penalty when we have an explicit target
  const directionPenalty = targetAspect !== undefined && wrongDirection ? 10.0 : 0;
  
  // ...rest unchanged...
}
```

### Change 2: Update `findBestRowSplit` to accept undefined target

```typescript
// src/lib/collageLayout.ts - findBestRowSplit
function findBestRowSplit(
  dims: PhotoDimension[],
  targetAspect: number | undefined,  // Change to optional
  isLandscape: boolean,
  randomize: boolean = false,
  minPhotosPerRow: number = 2
): PhotoDimension[][] {
  // Pass through to scorePartition (which now handles undefined)
}
```

### Change 3: Update `packPhotosIntoRegion` to not default targetAspect

```typescript
// src/lib/collageLayout.ts - packPhotosIntoRegion
// Remove the default - pass undefined through
const effectiveTargetAspect = targetAspect ?? (targetHeight ? width / targetHeight : undefined);
const partition = findBestRowSplit(dims, effectiveTargetAspect, isLandscape, false, minPhotosPerRow);
```

### Change 4: Update `buildContentRowsBlock` to not force isLandscape

```typescript
// src/lib/layoutBlocks.ts - buildContentRowsBlock
const result = packPhotosIntoRegion(photos, {
  width: canvasWidth,
  gap,
  offsetX: 0,
  offsetY: 0,
  isLandscape: false,  // Neutral - let minPhotosPerRow drive shape
  minPhotosPerRow,
  // No targetAspect - let it be undefined
});
```

## Result

In auto mode with no heroes:
- `targetAspect` is `undefined` throughout
- `aspectDiff` becomes 0 (no aspect penalty)
- `directionPenalty` becomes 0 (no orientation gate)
- **Only `minPhotosPerRow` penalty affects scoring**
- Low `minPhotosPerRow` (2) allows many rows → taller layouts
- High `minPhotosPerRow` (5) forces fewer rows → wider layouts

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Make `targetAspect` optional in `scorePartition`, `findBestRowSplit`; remove default in `packPhotosIntoRegion` |
| `src/lib/layoutBlocks.ts` | Remove `isLandscape: true` hardcode, don't pass `targetAspect` |

## Why This Is Different From My Earlier Plan

My earlier plan was **wrong** - I was suggesting to *thread* `targetAspect` through and randomize it. But your earlier analysis was correct: we should use `minPhotosPerRow` as the **sole** lever and **remove** `targetAspect` from the auto-mode flow entirely.

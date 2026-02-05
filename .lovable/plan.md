
# Remove Legacy `idealRows` and `isLandscape` from Row Search

## Problem Summary

The `findBestRowSplit` function has hardcoded logic that ignores `minPhotosPerRow`:

```typescript
// Lines 278-289 - THE PROBLEM
const idealPhotosPerRow = isLandscape ? 5 : 3;  // Hardcoded!
const idealRows = Math.ceil(n / idealPhotosPerRow);

const minRows = isLandscape ? ... : Math.max(1, idealRows - 1);
const maxRows = isLandscape ? ... : Math.min(n, idealRows + 3, 10);
```

With `isLandscape: false` and 24 photos, this always searches 7-10 rows regardless of `minPhotosPerRow`.

## Solution: Replace with Simple Range from `minPhotosPerRow`

### Change 1: Simplify `findBestRowSplit` search range

**File: `src/lib/collageLayout.ts` (lines 278-289)**

Replace the entire `idealPhotosPerRow`/`idealRows` block with:

```typescript
// Derive row count range from minPhotosPerRow
// maxRows = point where rows become too sparse (violate min threshold)
// minRows = 1 (allow exploring very wide layouts)
const maxRows = Math.min(n, Math.ceil(n / minPhotosPerRow) + 2);
const minRows = Math.max(1, Math.floor(n / 8)); // At least explore some rows
```

This gives for 24 photos:
- `minPhotosPerRow = 2` → maxRows = 14, explores 3-14 rows
- `minPhotosPerRow = 5` → maxRows = 7, explores 3-7 rows

### Change 2: Remove `isLandscape` parameter from `findBestRowSplit`

Since `isLandscape` is no longer needed for the search range:

```typescript
function findBestRowSplit(
  dims: PhotoDimension[],
  targetAspect: number | undefined,
  // REMOVE: isLandscape: boolean,
  randomize: boolean = false,
  minPhotosPerRow: number = 2
): PhotoDimension[][] {
```

### Change 3: Update `scorePartition` to not need `isLandscape`

The `wrongDirection` penalty is already gated by `targetAspect !== undefined`. When `targetAspect` is defined (explicit orientation mode), we can derive `isLandscape` from it:

```typescript
function scorePartition(
  partition: PhotoDimension[][],
  targetAspect: number | undefined,
  // REMOVE: isLandscape: boolean,
  baseWidth: number = 1200,
  minPhotosPerRow: number = 2
): PartitionScore {
  // ...
  
  // Derive orientation from targetAspect if present
  const wrongDirection = targetAspect !== undefined && (
    targetAspect >= 1.0 
      ? resultAspect < 1.0   // Target is landscape, result is portrait
      : resultAspect > 1.0   // Target is portrait, result is landscape
  );
  const directionPenalty = wrongDirection ? 10.0 : 0;
```

### Change 4: Update call sites

**`packPhotosIntoRegion`**: Remove `isLandscape` from the call to `findBestRowSplit`

```typescript
const partition = findBestRowSplit(dims, effectiveTargetAspect, false, minPhotosPerRow);
```

**`RegionPackOptions` interface**: Remove `isLandscape` field (it's no longer used)

**`buildContentRowsBlock`**: Remove `isLandscape: false` from options

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Remove `isLandscape` from `scorePartition` and `findBestRowSplit` signatures; replace `idealRows` logic with `minPhotosPerRow`-based range |
| `src/lib/layoutBlocks.ts` | Remove `isLandscape` from `packPhotosIntoRegion` calls |

## Expected Result

After this change:
- **No "ideal"** - just a search range
- **`minPhotosPerRow` directly controls** how many rows are explored
- Low values (2) allow many rows → tall layouts
- High values (5) limit rows → wide layouts
- Scoring picks the best based on area uniformity (the sparsePenalty ensures rows meet the minimum threshold)

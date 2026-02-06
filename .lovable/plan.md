

# Fix: Integrate Minimum Cell Size into Split Search

## Summary

Hero layouts are failing because the "minimum cell size" constraint (80px) is checked **after** packing and scaling, rather than being part of the split search. This causes valid-looking splits to be rejected late in the pipeline, often leaving no alternatives.

---

## Design Intent

**What problem are we solving?**  
The split search finds configurations that look good in normalized space, but when scaled to pixels (480px canvas), the cells end up too small (below 80px). The search needs to know about this constraint upfront so it can avoid proposing invalid splits.

**What will users experience?**  
Hero layouts will generate consistently. The algorithm will only propose splits where every cell meets the minimum size requirement.

---

## The Bug

### Current Flow

```text
findBestSplit():
  Search over besideCount, besideRowCount
  Pack BESIDE and BELOW in normalized space
  Validate only: canvas AR
  Score and return best

evaluateNormalizedProposal():
  Use split result to pack both regions
  Scale to pixels
  Validate: canvas AR, prominence, cell sizes  ← TOO LATE
  
  Result: Reject splits that seemed valid
```

### Example from Debug Logs

With 23 photos, heroAR 1.73, canvasWidth 480px:

| Step | Value |
|------|-------|
| Best split | besideCount:2, belowCount:20, belowRowCount:2 |
| BELOW photos per row | ~10 |
| BELOW cell width | 480 / (heroRowWidth) * (cellNormalizedWidth) ≈ 40-60px |
| Minimum required | 80px |
| Result | "Cells too small" → rejected |

The split search thought this was valid because it only checked canvas AR. But 10 photos per row is too dense for an 80px minimum.

---

## The Fix

Add a maximum-photos-per-row constraint to the split search, derived from the minimum cell size:

```text
maxPhotosPerRow = floor(canvasWidth / minCellSize)
               = floor(480 / 80)
               = 6 photos per row
```

Any split that would require more than 6 photos per row in BELOW should be rejected during the search.

---

## Math: Deriving the Constraint

For a given BELOW configuration:
- `n` photos in `R` rows → ~`n/R` photos per row
- Each cell width ≈ `rowWidth / (n/R)` = `rowWidth × R / n`
- In pixels: `pixelWidth = normalizedWidth × scaleFactor × R / n`

For pixelWidth >= minCellSize:
```text
normalizedWidth × scaleFactor × R / n >= minCellSize
```

But we can simplify: the scaleFactor ≈ `canvasWidth / heroRowWidth`, and the tightest constraint is when cells are narrowest (wide rows).

**Simple approximation**: 
- Maximum cells per row = `floor(canvasWidth / minCellSize)`
- For 480px and 80px min: 6 cells/row max

This gives a hard upper bound on photos per row in any region.

---

## File Changes

### 1. `src/lib/v3/split-search.ts` — Add density constraint to search

Add a pre-filter that rejects splits where BELOW would have too many photos per row:

```typescript
// Near top of loop (around line 71):
const photosPerRowBelow = Math.ceil(belowPhotos.length / belowRowCount);
const maxPhotosPerRow = Math.floor(canvasWidth / tuning.region_minWidth);

if (photosPerRowBelow > maxPhotosPerRow) {
  devLogger.log('v3-split', 'Split rejected: too many photos per row', {
    photosPerRowBelow,
    maxPhotosPerRow,
    belowCount: belowPhotos.length,
    belowRowCount,
  });
  continue;
}
```

But wait — `findBestSplit` doesn't know `canvasWidth`. We need to either:
1. Pass `canvasWidth` to `findBestSplit`, OR
2. Compute this constraint in `evaluateNormalizedProposal` before calling split search

Option 2 is cleaner — calculate the constraint once and pass it as a tuning parameter.

### Updated Approach:

**In `evaluateNormalizedProposal`:**
- Calculate `maxPhotosPerRow = floor(canvasWidth / minCellSize)`
- Pass to `findBestSplit`

**In `findBestSplit`:**
- Accept new parameter `maxPhotosPerRow`
- Reject any split where `ceil(belowPhotos.length / belowRowCount) > maxPhotosPerRow`
- Also check BESIDE: `ceil(besidePhotos.length / besideRowCount) > maxPhotosPerRow`

### 2. `src/lib/v3/intersection.ts` — Pass maxPhotosPerRow

In `evaluateNormalizedProposal`:
```typescript
// Before calling findBestSplit (around line 135):
const maxPhotosPerRow = Math.floor(canvasWidth / tuning.region_minWidth);

const splitResult = findBestSplit(
  contentPhotos,
  heroAR,
  estimatedNormalizedGap,
  tuning,
  maxPhotosPerRow  // NEW parameter
);
```

### 3. `src/lib/v3/types.ts` — No changes needed

The `region_minWidth` parameter already exists in tuning.

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/split-search.ts` | Add `maxPhotosPerRow` parameter to `findBestSplit`, reject splits that exceed density |
| `src/lib/v3/intersection.ts` | Calculate `maxPhotosPerRow` from `canvasWidth / region_minWidth`, pass to split search |

---

## Result

**Before**: Split search finds a 20-photo BELOW in 2 rows (10/row), scales to pixels, cells are 48px wide, rejected as "too small"

**After**: Split search calculates max 6 photos/row, rejects 2-row config for 20 photos, tries more rows or fewer BELOW photos, finds valid config

---

## Edge Case: What if no valid split exists?

If even the maximum row count still can't fit all photos with 80px minimum cells, the layout will return `null` (no silent fallback). This is correct behavior — it means the photo count/canvas size combination is fundamentally impossible to lay out with these constraints.

For 480px canvas with 80px minimum:
- Max 6 photos per row
- With gaps (~8px each), effectively ~5-6 usable cells
- For 20 photos: need at least ceil(20/6) = 4 rows

The algorithm will find this naturally once the constraint is integrated into the search.


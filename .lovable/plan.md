

# Fix: Adjust Landscape `minPhotosPerRow` Range

## Problem

With 24 photos and Shape=Landscape, the layout algorithm frequently picks a 3-row layout that feels cramped. This happens because:

**Current calculation:**
- `sqrtN = √24 ≈ 4.9`
- Landscape range = `[sqrtN, max(sqrtN + 1, n/2)]` = `[4.9, 12]`
- Midpoint = **(4.9 + 12) / 2 ≈ 8.45**

With `minPhotosPerRow ≈ 8.45`:
- `maxRows = ceil(24 / 8.45) + 2 = 5`
- `minRows = floor(24 / 8) = 3`
- Algorithm explores only **3-5 rows**
- The `sparsePenalty` penalizes rows with fewer than 8.45 photos
- 3-row layouts (8 photos/row) get zero penalty → they win

## Solution

Reduce the landscape upper bound from `n/2` to something more reasonable like `sqrtN + 3` or `sqrtN * 1.5`. This will:
- Keep the range above √n (so it's still landscape-biased)
- Avoid forcing extremely dense rows (8+ photos per row)

### Proposed Range Adjustments

| Shape | Current Range (n=24) | Proposed Range (n=24) |
|-------|---------------------|----------------------|
| Portrait | [2, 4.9] | [2, 4.9] (unchanged) |
| Square | [3.9, 5.9] | [3.9, 5.9] (unchanged) |
| Landscape | [4.9, 12] | [4.9, 7.4] (sqrtN * 1.5) |
| Auto | [2, 8] | [2, 8] (unchanged) |

With the new landscape range [4.9, 7.4]:
- Midpoint ≈ 6.15
- `maxRows = ceil(24 / 6.15) + 2 = 6`
- Algorithm explores **3-6 rows**
- 4-row layouts (6 photos/row) become competitive

## Code Change

**File:** `src/lib/collageLayout.ts`

```typescript
case 'landscape':
  // Above √n = fewer rows = wide
  // Cap at sqrtN * 1.5 to avoid overly dense rows
  return [sqrtN, sqrtN * 1.5];
```

## Expected Behavior After Fix

| Rows | Photos/Row | Old Penalty | New Penalty |
|------|------------|-------------|-------------|
| 3 | 8 | 0 | 5 * (8.45 - 8) = ~2.3 (small) |
| 4 | 6 | 5 * (8.45 - 6) = ~12 | 0 |
| 5 | ~5 | 5 * (8.45 - 5) = ~17 | 5 * (6.15 - 5) = ~5.8 |
| 6 | 4 | 5 * (8.45 - 4) = ~22 | 5 * (6.15 - 4) = ~10.8 |

With the new range, 4-row layouts (6 photos/row) become the natural winner for landscape, giving a more balanced wide appearance instead of 3 cramped rows.


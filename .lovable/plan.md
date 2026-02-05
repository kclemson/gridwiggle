

# Fix: Adjust Portrait `minPhotosPerRow` Range

## Problem

With 24 photos and Shape=Portrait, the layout still frequently produces landscape-ish layouts (4-5 rows). This happens because:

**Current calculation:**
- `sqrtN = √24 ≈ 4.9`
- Portrait range = `[2, sqrtN]` = `[2, 4.9]`
- Midpoint = **(2 + 4.9) / 2 ≈ 3.45**

With `minPhotosPerRow ≈ 3.45`, there's a conflict:
- **Direction penalty** pushes toward more rows (portrait)
- **Sparse penalty** pushes toward fewer rows (denser) because rows with 2-3 photos get penalized

For an 8-row layout (3 photos/row, very portrait):
- Direction penalty = 0 (correct orientation)
- Sparse penalty = `5 * (3.45 - 3) = 2.25` per sparse row

For a 4-row layout (6 photos/row, landscape):
- Direction penalty = `10 * (1.3 - 0.9) = 4.0`
- Sparse penalty = 0

The penalties partially cancel out, allowing 4-row layouts to win if they have better uniformity.

---

## Solution

Lower the portrait range upper bound from `sqrtN` to `sqrtN * 0.7`. This reduces the `minPhotosPerRow` threshold so that sparse rows (2-3 photos) aren't penalized in portrait mode.

### Proposed Range Adjustments

| Shape | Current Range (n=24) | Proposed Range (n=24) |
|-------|---------------------|----------------------|
| Portrait | [2, 4.9] | [2, 3.4] (sqrtN * 0.7) |
| Square | [3.9, 5.9] | [3.9, 5.9] (unchanged) |
| Landscape | [4.9, 7.4] | [4.9, 7.4] (unchanged) |
| Auto | [2, 8] | [2, 8] (unchanged) |

With the new portrait range [2, 3.4]:
- Midpoint ≈ 2.7
- Rows with 3 photos get zero sparse penalty
- Direction penalty dominates, pushing toward more rows

---

## Code Change

**File:** `src/lib/collageLayout.ts`

```typescript
case 'portrait':
  // Below √n = more rows = tall
  // Lower upper bound to reduce sparse penalty for 2-3 photo rows
  return [2, sqrtN * 0.7];
```

---

## Expected Behavior After Fix

**n=24, Shape=Portrait:**

| Rows | Photos/Row | Old Sparse Penalty | New Sparse Penalty |
|------|------------|-------------------|-------------------|
| 4 | 6 | 0 | 0 |
| 5 | ~5 | 0 | 0 |
| 6 | 4 | 0 | 0 |
| 8 | 3 | 5 * (3.45 - 3) = 2.25 | 0 |
| 12 | 2 | 5 * (3.45 - 2) = 7.25 | 0 |

With the new range, the sparse penalty no longer fights against the direction penalty. High row-count layouts (6-8+ rows) can now win for portrait, producing truly tall collages.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Change portrait case from `[2, sqrtN]` to `[2, sqrtN * 0.7]` |


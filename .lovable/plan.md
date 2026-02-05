

# Fix: Enforce `maxPhotosPerRow` Constraint

## Problem Summary

The single-block architecture works for shape scoring, but `findBestRowSplit` has no upper bound on row density. With 64 photos in "Auto" mode, the algorithm finds that 3–4 extremely wide rows minimize area variance (`areaCV`), creating horizontal strips.

**Root cause**: Line 324 sets `minRows = floor(n/8) = 8` for 64 photos, but this is just a floor for exploration—the scoring still favors fewer rows because uniform area = low `areaCV`. The penalty at line 249 (`0.1 * (maxRowSize - 6)`) is too weak.

---

## Matrix Analysis: Current vs. Proposed

### Current Behavior (Broken)

| n | Shape | minRows (floor) | What Algorithm Picks | Result |
|---|-------|-----------------|---------------------|--------|
| 9 | Auto | 1 | 3 rows × 3 | ✓ Balanced |
| 16 | Auto | 2 | 4 rows × 4 | ✓ Balanced |
| 36 | Auto | 4 | 3-4 rows × 9-12 | ⚠ Wide-ish |
| 64 | Auto | 8 | 3-4 rows × 16-21 | ✗ Horizontal strip |
| 64 | Portrait | 8 | 4 rows × 16 | ✗ Still wide (penalty too weak) |

### Proposed `maxPhotosPerRow` Calculation

Using √n as anchor, scaled by shape:

```text
function getMaxPhotosPerRow(n: number, shape: CollageSettings['shape']): number {
  const sqrtN = Math.sqrt(n);
  
  switch (shape) {
    case 'portrait':   return Math.max(4, Math.floor(sqrtN * 0.7));
    case 'square':     return Math.max(5, Math.round(sqrtN));
    case 'auto':       return Math.max(6, Math.round(sqrtN));
    case 'landscape':  return Math.max(8, Math.ceil(sqrtN * 1.3));
    default:           return Math.max(6, Math.round(sqrtN));
  }
}
```

### Proposed Matrix

| n | √n | Shape | maxPhotosPerRow | minRows = ceil(n/max) | Avg/Row | Result Aspect |
|---|-----|-------|-----------------|----------------------|---------|---------------|
| 9 | 3 | Portrait | 4 | 3 | 3 | Tall |
| 9 | 3 | Square | 5 | 2 | 4-5 | ~1:1 |
| 9 | 3 | Auto | 6 | 2 | 4-5 | Balanced |
| 9 | 3 | Landscape | 8 | 2 | 4-5 | Wide |
| 16 | 4 | Portrait | 4 | 4 | 4 | Tall |
| 16 | 4 | Square | 5 | 4 | 4 | ~1:1 |
| 16 | 4 | Auto | 6 | 3 | 5-6 | Balanced |
| 16 | 4 | Landscape | 8 | 2 | 8 | Wide |
| 36 | 6 | Portrait | 4 | 9 | 4 | Very tall |
| 36 | 6 | Square | 6 | 6 | 6 | ~1:1 |
| 36 | 6 | Auto | 6 | 6 | 6 | Balanced |
| 36 | 6 | Landscape | 8 | 5 | 7-8 | Wide |
| 64 | 8 | Portrait | 5 | 13 | 5 | Tall |
| 64 | 8 | Square | 8 | 8 | 8 | ~1:1 |
| 64 | 8 | Auto | 8 | 8 | 8 | Balanced |
| 64 | 8 | Landscape | 10 | 7 | 9-10 | Wide |
| 100 | 10 | Portrait | 7 | 15 | 6-7 | Tall |
| 100 | 10 | Square | 10 | 10 | 10 | ~1:1 |
| 100 | 10 | Auto | 10 | 10 | 10 | Balanced |
| 100 | 10 | Landscape | 13 | 8 | 12-13 | Wide |

Key observations:
- For 64 photos in Auto: 8 rows of 8 → balanced collage ✓
- For 64 photos in Portrait: 13 rows of 5 → tall collage ✓
- For 64 photos in Landscape: 7 rows of 9-10 → wide collage ✓
- Small sets (9-16 photos) still get reasonable variety

---

## Technical Implementation

### File: `src/lib/collageLayout.ts`

#### 1. Add `getMaxPhotosPerRow` function (after `getMinPhotosPerRowRange`, ~line 58)

```typescript
/**
 * Calculate maximum photos per row based on photo count and shape.
 * This is an ACTUAL CONSTRAINT, not just a scoring hint.
 * 
 * Uses √n as anchor:
 * - Portrait: narrow rows → many rows → tall
 * - Landscape: wide rows → few rows → wide
 */
function getMaxPhotosPerRow(
  n: number,
  shape: CollageSettings['shape']
): number {
  const sqrtN = Math.sqrt(n);
  
  switch (shape) {
    case 'portrait':
      // Narrow rows for tall layouts
      return Math.max(4, Math.floor(sqrtN * 0.7));
      
    case 'square':
      // Balanced
      return Math.max(5, Math.round(sqrtN));
      
    case 'landscape':
      // Wide rows for landscape layouts
      return Math.max(8, Math.ceil(sqrtN * 1.3));
      
    case 'auto':
    default:
      // Balanced default
      return Math.max(6, Math.round(sqrtN));
  }
}
```

#### 2. Update `findBestRowSplit` (lines 308-360)

Add `shape` parameter to calculate `maxPhotosPerRow` and derive a proper `minRows` floor:

```typescript
function findBestRowSplit(
  dims: PhotoDimension[],
  shape: CollageSettings['shape'],
  randomize: boolean = false,
  minPhotosPerRow: number = 2
): PhotoDimension[][] {
  const workingDims = randomize ? shuffleArray(dims) : dims;
  const n = workingDims.length;
  
  if (n <= 1) return [workingDims];
  
  // Calculate max photos per row based on shape
  const maxPhotosPerRow = getMaxPhotosPerRow(n, shape);
  
  // minRows: ensure no row exceeds maxPhotosPerRow
  // maxRows: where rows become too sparse
  const minRowsFromMax = Math.ceil(n / maxPhotosPerRow);
  const minRowsFromDensity = Math.max(1, Math.floor(n / 8));
  const minRows = Math.max(minRowsFromMax, minRowsFromDensity);
  
  const maxRows = Math.min(n, Math.ceil(n / minPhotosPerRow) + 2);
  
  // ... rest of function unchanged
}
```

#### 3. Update `scorePartition` penalty (line 249)

Make the penalty for exceeding `maxPhotosPerRow` much stronger:

```typescript
function scorePartition(
  partition: PhotoDimension[][],
  shape: CollageSettings['shape'],
  baseWidth: number = 1200,
  minPhotosPerRow: number = 2
): PartitionScore {
  // ... existing code ...
  
  const rowSizes = partition.map(r => r.length);
  const minRowSize = Math.min(...rowSizes);
  const maxRowSize = Math.max(...rowSizes);
  
  // Calculate shape-aware max
  const totalPhotos = partition.flat().length;
  const maxPhotosPerRow = getMaxPhotosPerRow(totalPhotos, shape);
  
  const sparsePenalty = minRowSize < minPhotosPerRow 
    ? 5.0 * (minPhotosPerRow - minRowSize) 
    : 0;
  
  // Strong penalty for exceeding max (was 0.1 for >6, now shape-aware)
  const overMaxPenalty = maxRowSize > maxPhotosPerRow
    ? 3.0 * (maxRowSize - maxPhotosPerRow)
    : 0;
  
  const rowBalancePenalty = sparsePenalty + overMaxPenalty;
  
  // ... rest unchanged
}
```

---

## Summary of Changes

| Location | Change |
|----------|--------|
| Line ~58 | Add `getMaxPhotosPerRow(n, shape)` function |
| Line 324 | Replace static `minRows = floor(n/8)` with `max(ceil(n/maxPhotosPerRow), floor(n/8))` |
| Line 249 | Replace weak `0.1 * (maxRowSize - 6)` with strong shape-aware `3.0 * (maxRowSize - max)` |

---

## Expected Outcomes

For 64 photos:
- **Auto**: 8 rows × 8 photos → balanced collage
- **Portrait**: 13 rows × 5 photos → tall collage  
- **Square**: 8 rows × 8 photos → 1:1 aspect
- **Landscape**: 7 rows × 9-10 photos → wide collage

The horizontal strip bug will be eliminated because the algorithm is now **forced** to explore layouts with enough rows to respect the `maxPhotosPerRow` ceiling.


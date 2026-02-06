

# Remove Row Count Determinism and avgAR Bias

## Summary

Replace the deterministic `calculateOptimalRowCount` function with random selection from a valid geometric range. This addresses:

1. **Determinism** - Each shuffle will explore different row counts
2. **avgAR bias** - Row count selection no longer assumes portrait photos need tall canvases

---

## Changes

### 1. Add `randomInt` helper to `src/lib/v3/utils.ts`

```typescript
/**
 * Random integer in range [min, max] inclusive.
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

### 2. Replace `calculateOptimalRowCount` in `src/lib/v3/row-pack.ts`

**Before** (lines 263-291):
```typescript
function calculateOptimalRowCount(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  tuning: V3Tuning
): number {
  const avgAR = mean(photos.map(p => p.aspectRatio));
  const n = photos.length;
  const maxPhotosPerRow = Math.floor(region.width / tuning.region_minWidth);
  const minRows = Math.ceil(n / maxPhotosPerRow);
  const maxRows = Math.ceil(n / 2);
  const targetRows = Math.max(minRows, Math.min(maxRows, Math.ceil(Math.sqrt(n / avgAR))));
  return Math.max(1, targetRows);
}
```

**After**:
```typescript
function pickRandomRowCount(
  photoCount: number,
  regionWidth: number,
  tuning: V3Tuning
): number {
  const maxPhotosPerRow = Math.floor(regionWidth / tuning.region_minWidth);
  const minRows = Math.max(1, Math.ceil(photoCount / maxPhotosPerRow));
  const maxRows = Math.max(minRows, Math.ceil(photoCount / 2));
  const chosen = randomInt(minRows, maxRows);
  
  devLogger.log('v3', 'Row count selection', {
    photoCount,
    minRows,
    maxRows,
    chosen,
  });
  
  return chosen;
}
```

### 3. Update call site in `packPhotosIntoRegion`

**Before** (line 117):
```typescript
let rowCount = calculateOptimalRowCount(photos, region, gap, tuning);
```

**After**:
```typescript
let rowCount = pickRandomRowCount(photos.length, region.width, tuning);
```

### 4. Update imports

Add `randomInt` import and `devLogger` import to `row-pack.ts`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/v3/utils.ts` | Add `randomInt` helper |
| `src/lib/v3/row-pack.ts` | Replace `calculateOptimalRowCount` with `pickRandomRowCount`, add logging, update imports |

---

## Result

For 20 photos in a 480px region with `region_minWidth: 80`:

```text
maxPhotosPerRow = floor(480 / 80) = 6
minRows = ceil(20 / 6) = 4
maxRows = ceil(20 / 2) = 10

Valid range: 4-10 rows
```

Each shuffle randomly picks from [4, 5, 6, 7, 8, 9, 10], producing canvas heights ranging from wide/short (4 rows) to tall/narrow (10 rows) - regardless of whether photos are portrait or landscape.


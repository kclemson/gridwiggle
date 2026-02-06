

# Canvas AR-Constrained Row Count Selection

## Summary

Replace the naive "at least 2 photos per row" constraint with geometry-derived bounds based on canvas aspect ratio limits. This ensures layouts stay within reasonable proportions while still allowing variety.

---

## Design Intent

**Problem**: The current random approach allows extreme outcomes (48 photos resulting in a 10:1 vertical strip) because it only enforces "at least 2 photos per row."

**Solution**: Define explicit canvas AR guardrails and derive the allowed row count range from those bounds.

**User Outcome**: Every shuffle produces a different layout, but all stay within "reasonable" proportions (e.g., between 1:2 and 2:1).

---

## Changes

### 1. Add tuning parameters to `src/lib/v3/types.ts`

Add to `V3Tuning` interface:
```typescript
// === Canvas Proportion Limits ===
/** Minimum canvas aspect ratio (most portrait allowed), e.g. 0.5 = 1:2 */
canvas_minAR: number;
/** Maximum canvas aspect ratio (most landscape allowed), e.g. 2.0 = 2:1 */
canvas_maxAR: number;
```

Add to defaults:
```typescript
canvas_minAR: 0.5,
canvas_maxAR: 2.0,
```

### 2. Update `pickRandomRowCount` in `src/lib/v3/row-pack.ts`

- Add `mean` import back to utils
- Change function signature to accept `photos: PhotoDimension[]` instead of `photoCount`
- Calculate `avgAR` from photos
- Derive row bounds using `r = sqrt(n * avgAR / canvasAR)`
- Enhanced logging with all constraint values

### 3. Update call site

Change from:
```typescript
pickRandomRowCount(photos.length, region.width, tuning)
```
To:
```typescript
pickRandomRowCount(photos, region.width, tuning)
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Add `canvas_minAR` and `canvas_maxAR` tuning parameters |
| `src/lib/v3/row-pack.ts` | Update `pickRandomRowCount` to use canvas AR bounds, add `mean` import, update call site |

---

## Result

For 48 photos with avgAR ~1.2:

**Before**: Valid range 8-24 rows (allows AR ~0.09 extremes)

**After**: Valid range ~5-10 rows (all layouts between 1:2 and 2:1)


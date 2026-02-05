

# Plan: Add More Photo Counts to Test Cases

## Summary

Add photo counts 6, 11, and 14 to `TEST_PHOTO_COUNTS` for better coverage of edge cases in row-packing math, and update `BATCH_SIZE` accordingly.

## Changes

### 1. `src/test/layout/photoGenerator.ts`

Update `TEST_PHOTO_COUNTS` to include the new values in sorted order:

```typescript
export const TEST_PHOTO_COUNTS = [5, 6, 7, 9, 11, 12, 14, 17, 23, 35, 50] as const;
```

### 2. `src/pages/LayoutRating.tsx`

Update `BATCH_SIZE` based on new calculation:

| Photo Count | Shapes | Hero Modes | Cases |
|-------------|--------|------------|-------|
| 5 | 1 (auto only, < 6) | 2 | 2 |
| 6+ (10 counts) | 4 | 2 | 80 |
| **Total** | | | **82** |

```typescript
const BATCH_SIZE = 82; // 5 photos: 1 shape × 2 hero = 2; 6+ photos (10 counts): 4 shapes × 2 hero = 80
```

## Why These Counts

- **6**: First count where shape control is enabled (tests boundary)
- **11**: Prime number, odd - stresses row-packing differently than even counts
- **14**: Between 12 and 17, fills gap in mid-range testing


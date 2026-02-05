

# Plan: Update Test Photo Counts to Match Shape Thresholds

## Summary

The test generation still includes photo counts (5, 6, 7) that are below the new shape thresholds. Since portrait/landscape now require 8 photos and square requires 10, we should clean up the test counts to avoid generating test cases that only produce "auto" results.

## Problem Analysis

Current `TEST_PHOTO_COUNTS = [5, 6, 7, 9, 11, 12, 14, 17, 23, 35, 50]`:
- **5, 6, 7 photos**: Only "auto" is available (below 8-photo minimum)
- **9 photos**: Only "auto", "landscape", "portrait" (below 10-photo square minimum)
- **10+ photos**: All shapes available

The old session in your browser was persisted **before** the threshold updates, which is why you're seeing a "SQUARE-ISH (7)" case.

## Proposed Changes

### 1. Update `TEST_PHOTO_COUNTS` in `src/test/layout/photoGenerator.ts`

Remove counts that don't add testing value:

```text
Current:  [5, 6, 7, 9, 11, 12, 14, 17, 23, 35, 50]
Proposed: [8, 9, 10, 12, 14, 17, 23, 35, 50]
```

Rationale:
- **8**: Minimum for portrait/landscape (edge case testing)
- **9**: One more photo, still no square (tests portrait/landscape scaling)
- **10**: Minimum for square (edge case testing)
- **12, 14, 17, 23, 35, 50**: Larger counts for varied configurations

Removed:
- **5, 6, 7**: Only produce "auto" layouts - these already work well and don't need ratings
- **11**: No unique edge case value vs 10 and 12

### 2. Update `BATCH_SIZE` comment in `src/pages/LayoutRating.tsx`

Update the calculation to reflect new counts:
```text
// New calculation:
// 8-9 photos (2 counts): 3 shapes = 6 cases
// 10+ photos (7 counts): 4 shapes = 28 cases
// Total: 34 base combinations
// With ~80% hero/20% no-hero weighting = ~34 test cases per batch
```

Change `BATCH_SIZE` from 82 to a more appropriate value (e.g., 44 to allow some margin for shuffle variance).

## Files to Modify

| File | Change |
|------|--------|
| `src/test/layout/photoGenerator.ts` | Update `TEST_PHOTO_COUNTS` array |
| `src/pages/LayoutRating.tsx` | Update `BATCH_SIZE` constant and comment |

## User Action Required

After these changes, you'll need to click **Reset** in the Layout Rating Tool to generate a fresh batch with the updated counts. The old session data in localStorage contains cases generated before the threshold updates.


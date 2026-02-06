

# Remove Column Mode Special Case

## Overview

Remove the redundant "column mode" special case (lines 61-102) from `packToFillHeight`. The unified multi-row formula already handles this case correctly - when each row has 1 photo, `rowAR = photoAR` and `intraRowGaps = 0`, producing identical results.

## Math Verification

**Column mode formula:**
```
W = (H - totalGapHeight) / Σ(1/photoAR_i)
```

**Unified formula when each row has 1 photo:**
```
rowAR_i = photoAR_i  (single photo per row)
intraRowGaps_i = 0   (no gaps within row)
sumGapOverAR = 0

W = (H - totalGapHeight + 0) / Σ(1/rowAR_i)
  = (H - totalGapHeight) / Σ(1/photoAR_i)  ✓ identical
```

## Technical Changes

### File: `src/lib/v3/normalized-pack.ts`

**Lines 61-102** - Remove the column mode special case entirely:

```typescript
// DELETE this entire block:
const allSinglePhotoRows = rows.every(row => row.length === 1);

if (allSinglePhotoRows) {
  // ... 35 lines of column-specific logic
}
```

The unified formula at lines 104-179 will now handle all cases - whether rows have 1, 2, or more photos each.

## Result

| Before | After |
|--------|-------|
| 2 code paths: column mode + multi-photo rows | 1 unified code path for all row configurations |
| Column mode: ~40 lines | Removed |
| Multi-photo mode: ~75 lines | Same ~75 lines handles everything |

This simplification also prepares us for the next improvement - removing round-robin distribution to allow creative row configurations like 2+3 photo splits.


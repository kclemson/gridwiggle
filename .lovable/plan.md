
# Fix BESIDE Row Width Alignment

## Problem

When `packToFillHeight` packs photos into multiple rows, each row ends up with its **natural width** at a fixed row height. Rows with different photo AR combinations have different widths, leaving gaps on the right edge:

```
Hero   |  Row 1: ████████░░░░   (narrow - gap on right)
       |  Row 2: ████████████   (wider - defines region width)
```

## Design Intent

All rows in the BESIDE region should have **identical width** (flush right edge). This is the same behavior `packToFillWidth` achieves for the BELOW region - all rows stretch to fill the target width.

## The Fix: Unified Formula

The current code has a special case for "column mode" (each row has 1 photo) that correctly derives a common width from the height constraint. The multi-row case should use the **same formula**, just treating each row as a unit instead of each photo.

### The Math

For R rows with varying photos per row, to achieve:
- Total height = `targetHeight`
- All rows have same width `W`
- Each row's height varies based on its content

**Formula:**
```
W = (targetHeight - totalGapHeight) / Σ(1 / rowAR_i)
```

Where `rowAR_i = sum of photo aspect ratios in row i`.

This is **identical** to the column mode formula - column mode is just the case where each row has one photo, so `rowAR = photoAR`.

## Technical Changes

### File: `src/lib/v3/normalized-pack.ts`

**Lines 104-149** - Replace the current multi-row logic with the unified approach:

```typescript
// Current (broken):
const rowHeight = (targetHeight - totalGapHeight) / rows.length;  // Fixed height per row
// Each row gets its natural width → uneven right edges

// Fixed (unified):
// 1. Calculate each row's "aspect ratio" (sum of photo ARs)
const rowARs = rows.map(row => 
  row.reduce((sum, p) => sum + p.aspectRatio, 0) + 
  (row.length - 1) * normalizedGap / 1  // Account for intra-row gaps
);

// 2. Derive common width from height constraint
const sumInverseRowAR = rowARs.reduce((sum, ar) => sum + 1 / ar, 0);
const regionWidth = (targetHeight - totalGapHeight) / sumInverseRowAR;

// 3. Pack each row at regionWidth (variable row heights)
rows.forEach(row => {
  const rowAR = rowARs[rowIndex];
  const rowHeight = regionWidth / rowAR;  // This row's height at regionWidth
  // ... position photos
});
```

### Key Insight

The column mode code (lines 67-102) already implements this correctly for single-photo rows. The fix extends the same principle to multi-photo rows.

**Before:** Row height is fixed → widths vary → gaps on right
**After:** Region width is derived → heights vary per row → flush right edge

## Visual Result

```
Before:                          After:
Hero  | ████████░░░░             Hero  | ████████████
      | ████████████                   | ████████████
      (uneven right edge)              (flush right edge)
```

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/lib/v3/normalized-pack.ts` | 104-149 | Replace fixed-rowHeight logic with unified width-derivation formula |

## Unification Benefit

After this fix, the column mode special case (lines 67-102) can actually be **removed** - it's just a specific instance of the general formula where each row happens to have one photo. However, keeping it as an optimization is fine since it's a common case.

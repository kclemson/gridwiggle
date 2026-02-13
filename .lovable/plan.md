
# Fix: Middle Band Uses Same Codepath as Hero-less Packing

## Problem

The middle band in diagonal-corners layouts packs 17 photos into 1 row because it's treated as a "height-targeted" region. The code sets `targetSoftDimension` to the leftover height between the two hero rows, which causes `packRegion` to call `packToFillWidthAtTargetHeight`. That function optimizes row count to match the tiny leftover height -- resulting in 1 row for 17 photos.

## Insight

The middle band is just "N photos filling a known width." That's the exact same problem a hero-less collage solves. The hero-less codepath uses plain `packToFillWidth` with a row count derived from photo count and width -- no height target. The middle band should do the same.

## What Changes

**One file: `src/workers/layoutWorker.ts`** -- Region 1 construction (lines 730-741)

**Current:**
```typescript
const targetMiddleHeight = topology.regions[1].softDimension;
const r1TargetRows = r1Count > 0
  ? deriveTargetRowCount(r1Count, r1MeanAR, heroRow1Width, Math.max(0.01, targetMiddleHeight))
  : 0;
let region1: PackableRegion = {
  constraint: 'width', targetDimension: heroRow1Width,
  targetSoftDimension: targetMiddleHeight > 0.01 ? targetMiddleHeight : undefined,
  photos: r1Photos, targetRowCount: r1TargetRows,
  offset: topology.regions[1].offset, result: null,
};
```

**New:**
```typescript
// Middle band: same codepath as hero-less packing.
// Don't constrain to leftover height -- let the packer choose rows
// based on photo count and width, then height follows naturally.
const r1TargetRows = r1Count > 0
  ? deriveTargetRowCount(r1Count, r1MeanAR, heroRow1Width, heroRow1Width / r1MeanAR)
  : 0;
let region1: PackableRegion = {
  constraint: 'width', targetDimension: heroRow1Width,
  // No targetSoftDimension -- height is unconstrained, just like hero-less
  photos: r1Photos, targetRowCount: r1TargetRows,
  offset: topology.regions[1].offset, result: null,
};
```

### What this does

1. **Removes `targetSoftDimension`** from Region 1 -- so `packRegion` calls plain `packToFillWidth` instead of `packToFillWidthAtTargetHeight`
2. **Changes `deriveTargetRowCount` input** -- passes `heroRow1Width / r1MeanAR` as the height argument instead of the tiny leftover height. This effectively asks "how many rows for square-ish cells at this width?" -- same logic as hero-less layouts.

### Same fix in `src/lib/v4/index.ts`

Apply the identical change in the sync fallback path if the same pattern exists there, keeping both paths in sync.

## Expected Row Counts (17 photos, meanAR ~1.2, width ~1.5)

| Scenario | Height input | Computed rows |
|----------|-------------|---------------|
| Current (leftover height) | 0.15 | 1 |
| Fixed (width-derived) | 1.25 | 4 |

## Why This Is Right

- The middle band's height was never a real constraint -- it's computed after packing, not before
- This uses the exact same packing codepath as hero-less layouts
- No new formulas, no floors, no density caps
- The beside-hero regions (0 and 2) correctly keep their `targetSoftDimension` because they ARE height-constrained (locked to hero height)
- Two single-line changes across two files

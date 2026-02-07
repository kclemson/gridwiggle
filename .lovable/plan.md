

# Fix Gap Inconsistency Bug

## The Problem

The layout has an extra-tall gap between the hero row and the BELOW region because two different gap values are being used:

1. **Packing phase**: Uses `estimatedNormalizedGap = 0.02` (hardcoded 2% of hero height)
2. **Pixel conversion phase**: Calculates `normalizedGap = gap / scaleFactor` (back-derived from pixel gap)

These produce different values, so the canvas is sized for one gap but cells are positioned using another.

## The Fix

Pass the normalized gap used during packing into the pixel conversion function, ensuring consistent positioning.

## Technical Changes

### File: `src/lib/v3/intersection.ts`

**1. Update `convertToPixels` signature**

Add `normalizedGap` as a parameter instead of deriving it from pixel gap:

```typescript
function convertToPixels(
  heroPhoto: PhotoDimension,
  position: string,
  heroAR: number,
  besideCells: NormalizedCell[],
  belowCells: NormalizedCell[],
  belowHeight: number,
  scaleFactor: number,
  normalizedGap: number,  // Changed: was pixel gap, now normalized gap
  normalizedWidth: number
): LayoutCell[]
```

**2. Remove back-calculation in convertToPixels**

Delete line 346:
```typescript
// DELETE THIS:
const normalizedGap = gap / scaleFactor;
```

The `normalizedGap` is now passed in as a parameter.

**3. Update call site in evaluateNormalizedProposal**

Change from:
```typescript
const pixelGap = gap;

const pixelCells = convertToPixels(
  heroPhoto,
  proposal.position,
  heroAR,
  besideResult.cells,
  belowResult.cells,
  belowResult.height,
  scaleFactor,
  pixelGap,        // was pixel gap
  normalizedWidth
);
```

To:
```typescript
const pixelCells = convertToPixels(
  heroPhoto,
  proposal.position,
  heroAR,
  besideResult.cells,
  belowResult.cells,
  belowResult.height,
  scaleFactor,
  estimatedNormalizedGap,  // now normalized gap (same as used in packing)
  normalizedWidth
);
```

## Why This Works

Before:
- Canvas height calculated with 2% gaps
- Cells positioned with 1.3% gaps
- Difference = empty space

After:
- Canvas height calculated with 2% gaps
- Cells positioned with 2% gaps
- Regions fit perfectly

## Future Improvement (Optional)

The `estimatedNormalizedGap = 0.02` is still a "guess" that may not match the user's desired pixel gap at all scales. A more robust approach would derive the normalized gap from the pixel gap after determining the scale factor. But that requires restructuring the algorithm to:

1. Do a first-pass pack to determine approximate scale
2. Calculate true normalized gap: `normalizedGap = pixelGap / scaleFactor`
3. Re-pack with correct gap
4. Convert to pixels

This is more complex and can be a follow-up improvement. The immediate fix ensures consistency with the current hardcoded value.


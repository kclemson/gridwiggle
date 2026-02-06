

# Add Bottom-Left and Bottom-Right Hero Positions

## What You'll Get

When shuffling, the hero photo will appear in **all four corners** of the collage - adding more visual variety.

```text
┌───┬──┐  ┌──┬───┐  ┌──────┐  ┌──────┐
│ H │  │  │  │ H │  │      │  │      │
├───┴──┤  ├──┴───┤  ├───┬──┤  ├──┬───┤
│      │  │      │  │ H │  │  │  │ H │
└──────┘  └──────┘  └───┴──┘  └──┴───┘
top-left  top-right bottom-left bottom-right
```

## Design

Bottom corners require flipping the vertical layout:

| Top Corners (current) | Bottom Corners (new) |
|-----------------------|----------------------|
| Hero row at y = 0 | Hero row at y = belowHeight + gap |
| BELOW at y = heroHeight + gap | BELOW at y = 0 |

The normalized space packing is identical - we just swap which region goes on top during pixel conversion.

## Technical Changes

### 1. Add Bottom Corner Proposals

**File:** `src/lib/v3/entities/hero.ts` (after line 60)

Add two new corner proposals:

```typescript
// Bottom-left: hero at bottom-left, BELOW region above
proposals.push({
  rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
  mode: 'corner',
  position: 'bottom-left',
});

// Bottom-right: hero at bottom-right, BELOW region above  
proposals.push({
  rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
  mode: 'corner',
  position: 'bottom-right',
});
```

### 2. Update Pixel Conversion for Bottom Positioning

**File:** `src/lib/v3/intersection.ts`

The `convertToPixels` function needs to:
1. Accept `belowHeight` as a parameter (needed to calculate hero Y position)
2. Handle vertical flipping for bottom corners

**Updated function signature (line 327):**
```typescript
function convertToPixels(
  heroPhoto: PhotoDimension,
  position: string,
  heroAR: number,
  besideCells: { ... }[],
  belowCells: { ... }[],
  belowHeight: number,  // NEW PARAMETER
  scaleFactor: number,
  gap: number,
  normalizedWidth: number
): LayoutCell[]
```

**Updated positioning logic:**

```typescript
// Determine if this is a bottom position
const isBottom = position === 'bottom-left' || position === 'bottom-right';
const isRight = position === 'top-right' || position === 'bottom-right';

// Hero X position (same as before)
const heroX = isRight 
  ? (normalizedWidth - heroNormalizedWidth) * scaleFactor 
  : 0;

// Hero Y position (NEW: flip for bottom)
const normalizedGap = gap / scaleFactor;
const heroY = isBottom 
  ? (belowHeight + normalizedGap) * scaleFactor  // Below the BELOW region
  : 0;

// BESIDE Y offset (same as hero)
const besideOffsetY = isBottom ? (belowHeight + normalizedGap) : 0;

// BELOW Y offset (inverted for bottom)
const belowOffsetY = isBottom 
  ? 0  // BELOW goes at top
  : 1.0 + normalizedGap;  // BELOW goes below hero row
```

### 3. Update Function Call

**File:** `src/lib/v3/intersection.ts` (around line 260)

Pass `belowResult.height` to `convertToPixels`:

```typescript
const pixelCells = convertToPixels(
  heroPhoto,
  proposal.position,
  heroAR,
  besideResult.cells,
  belowCells,
  belowResult.height,  // NEW ARGUMENT
  scaleFactor,
  pixelGap,
  normalizedWidth
);
```

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/lib/v3/entities/hero.ts` | 60-61 | Add bottom-left and bottom-right proposals |
| `src/lib/v3/intersection.ts` | 327-396 | Update `convertToPixels` to handle bottom positions |
| `src/lib/v3/intersection.ts` | ~260 | Pass `belowResult.height` to `convertToPixels` |

## Expected Outcome

When shuffling with V3 enabled, the hero will appear in all four corners with roughly equal probability (thanks to the random tiebreaker we just added).


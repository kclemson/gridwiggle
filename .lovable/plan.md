

# 2-Row Hero Layout: Guaranteed Visual Dominance

## The Core Insight

Making the hero span 2 rows of standard photos solves multiple problems at once:

1. **Guaranteed size hierarchy** - Hero is always ~2× larger than any single beside photo
2. **Better packing** - Two rows provide more flexibility to fill available width within tolerance
3. **Fewer black rectangles** - More photos beside = more combinations to hit the ±10% tolerance
4. **Inverted math** - Let the standard photos determine the height, hero adapts to match

## Mathematical Approach

### Current (problematic)

```text
Hero height = heroWidth / heroAspect
Beside height = heroHeight (shared)
Problem: If beside photo has similar aspect ratio → similar size!
```

### Proposed (2-row)

```text
Step 1: Pack standards into 2 rows at (canvasWidth - heroWidth - gap) width
Step 2: Get combinedBesideHeight = row1Height + gap + row2Height
Step 3: Hero height = combinedBesideHeight (spans both rows)
Step 4: Hero width = heroHeight × heroAspect
Step 5: Verify hero width fits; iterate if needed
```

This inverts the dependency:
- **Before**: Hero determines height → beside photos must match → often fails
- **After**: Beside photos packed naturally → hero matches their combined height → always works

## Algorithm Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   1. Split standards: ~4-6 for beside zone, rest for below zone    │
│                                                                     │
│   2. Pack beside photos into 2 rows at target width                │
│      (use existing row-packing algorithm)                          │
│                                                                     │
│   3. combinedHeight = row1 + gap + row2                            │
│                                                                     │
│   4. heroHeight = combinedHeight                                   │
│      heroWidth = heroHeight × heroAspect                           │
│                                                                     │
│   5. If heroWidth + besideWidth ≠ canvasWidth:                     │
│      Scale besideWidth to fit (within ±10% tolerance)              │
│      OR adjust hero fraction and retry                             │
│                                                                     │
│   6. Pack remaining photos in full-width rows below                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Visual Result

```text
Before (1-row beside):
┌──────────────────┬─────────────────┐
│                  │                 │
│      HERO        │    Photo A      │  ← Similar sizes!
│                  │                 │
└──────────────────┴─────────────────┘

After (2-row beside):
┌──────────────────┬────────┬────────┐
│                  │ A      │   B    │  ← Row 1
│      HERO        ├────────┼────────┤
│                  │   C    │ D │ E  │  ← Row 2
└──────────────────┴────────┴────────┘
Hero is 2× the height of any individual photo!
```

## Implementation Details

### File: src/lib/heroLayout.ts

**New function**: `packBesideAsRows`

This function takes beside photos and packs them into exactly 2 rows using the existing `packPhotosIntoRegion` function:

```typescript
function packBesideAsRows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): { 
  cells: CollageCell[]; 
  combinedHeight: number; 
  usedIds: Set<string>;
} {
  // Use existing row packing to split into 2 rows
  const result = packPhotosIntoRegion(photos, {
    width: targetWidth,
    gap,
    offsetX,
    offsetY: 0,
    isLandscape: true, // Prefer wider rows
  });
  
  // Ensure we get 2 rows (may need to force)
  // Return combined height for hero sizing
}
```

**Modified function**: `generateEdgeAnchoredHeroLayout`

1. Calculate target beside width as `canvasWidth × (1 - heroFraction) - gap`
2. Call `packBesideAsRows` with ~4-6 photos
3. Get `combinedHeight` from the 2 rows
4. Set hero height = `combinedHeight`
5. Calculate hero width from aspect ratio
6. Verify total width fits canvas (iterate if needed)
7. Pack remaining photos in below zone

### Hero Width Fraction Adjustment

Since the hero now spans 2 rows, it will be naturally larger. We can use a smaller width fraction:

```typescript
function calculateHeroWidthFraction(standardCount: number): number {
  // Reduced fractions since hero is now 2-rows tall
  if (standardCount <= 4) {
    return 0.55;  // Was 0.65
  } else if (standardCount <= 8) {
    return 0.45;  // Was 0.55
  } else if (standardCount <= 15) {
    return 0.40;  // Was 0.48
  } else {
    return 0.35;  // Was 0.40
  }
}
```

### Handling Edge Cases

**Few photos (< 4 standards):**
If there aren't enough photos for 2 beside rows, fall back to 1-row mode but with the hero explicitly sized larger.

**Odd aspect ratios:**
If the hero has a very wide or very tall aspect ratio, the 2-row combined height might make the hero too wide/narrow. The algorithm will verify and adjust by moving photos between beside and below zones.

## Technical Changes Summary

| File | Function | Change |
|------|----------|--------|
| heroLayout.ts | (new) `packBesideAsRows` | Pack photos into exactly 2 rows, return combined height |
| heroLayout.ts | `generateEdgeAnchoredHeroLayout` | Hero spans 2 beside rows instead of 1 |
| heroLayout.ts | `generateFloatingHeroLayout` | Same 2-row approach for left/right sides |
| heroLayout.ts | `calculateHeroWidthFraction` | Reduce fractions since hero is now taller |

## Expected Results

1. **Guaranteed visual hierarchy** - Hero is always ~2× larger than any beside photo
2. **No more "similar size" issue** - Even if aspects match, heights differ by 2×
3. **Better packing** - 2 rows of beside photos can fill width more reliably
4. **Fewer black rectangles** - More photos = more flexibility within ±10% tolerance
5. **Natural orientation** - Height emerges from packing math, not pre-calculated


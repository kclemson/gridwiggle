
# Algebraic Hero Width Fraction Calculation

## Overview

Replace the random `heroWidthFraction` selection with a calculated value derived from the specific aspect ratios of the hero and beside photos. This guarantees near-optimal layouts without tolerance failures.

## Core Insight

The current algorithm picks a random fraction, builds the layout, then checks if it fits. But since `packBesideAs2Rows` already makes each row fill `targetWidth` exactly, we can work backwards:

**Given the beside photos' aspect ratios, calculate the `heroWidthFraction` that produces `scaleFactor = 1.0`**

## Mathematical Derivation

For 2-row beside packing:

```text
Let:
  f = heroWidthFraction (what we want)
  W = canvasWidth  
  g = gap
  heroAR = hero aspect ratio
  R1 = row 1 aspect sum
  R2 = row 2 aspect sum
  n1, n2 = photos per row

besideWidth = W × (1 - f) - g

Row heights (to fill besideWidth):
  h1 = (besideWidth - (n1-1) × g) / R1
  h2 = (besideWidth - (n2-1) × g) / R2
  
Combined beside height:
  H = h1 + g + h2

Hero dimensions (matching beside height):
  heroWidth = H × heroAR

For perfect fit (scaleFactor = 1.0):
  heroWidth + g + besideWidth = W
  
Substituting and solving for f gives us the optimal fraction.
```

The key simplification: Since we already know the row aspect sums, we can express `H` as a function of `besideWidth`, then solve for the `f` that makes everything fit.

## Implementation

### New Function: `calculateOptimalHeroFraction`

```typescript
/**
 * Calculate the heroWidthFraction that makes scaleFactor ≈ 1.0
 * given the specific beside photos and hero aspect ratio.
 */
function calculateOptimalHeroFraction(
  heroAspect: number,
  besidePhotos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  rowCount: 2 | 3
): number {
  // Calculate aspect sums per row (same split logic as packing functions)
  const { row1AspectSum, row2AspectSum, row3AspectSum, n1, n2, n3 } = 
    getRowAspectSums(besidePhotos, rowCount);
  
  // Derive optimal fraction algebraically
  // (detailed math in implementation)
  
  // Clamp to reasonable range [0.30, 0.60]
  return clamp(optimalFraction, 0.30, 0.60);
}
```

### Refactored 2-Row Loop (lines 654-746)

**Before:**
```typescript
const widthFraction = calculateHeroWidthFraction(...); // Random
const targetBesideWidth = canvasWidth * (1 - widthFraction) - gap;

for (let besideCount = ...) {
  const packResult = packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0);
  
  // Check tolerance - often fails!
  const scaleFactor = canvasWidth / totalNaturalWidth;
  if (scaleFactor < 0.85 || scaleFactor > 1.15) continue;
}
```

**After:**
```typescript
for (let besideCount = ...) {
  const besidePhotos = remainingPhotos.slice(0, besideCount);
  
  // Calculate optimal fraction for THESE specific photos
  const optimalFraction = calculateOptimalHeroFraction(
    hero.aspectRatio,
    besidePhotos,
    canvasWidth,
    gap,
    2
  );
  
  const targetBesideWidth = canvasWidth * (1 - optimalFraction) - gap;
  const packResult = packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0);
  
  // scaleFactor will now be ≈ 1.0 (unless clamping applied)
  // No tolerance check needed - just build the layout
}
```

### Apply Same Pattern to 3-Row Loop (lines 554-650)

## Detailed Math for 2-Row Case

```text
Given:
  W = canvasWidth, g = gap, heroAR = hero aspect ratio
  R1, R2 = row aspect sums
  n1, n2 = photos per row

Let besideWidth = B

Row heights:
  h1 = (B - (n1-1)g) / R1
  h2 = (B - (n2-1)g) / R2

Combined height:
  H = h1 + g + h2
    = (B - (n1-1)g) / R1 + g + (B - (n2-1)g) / R2
    = B/R1 + B/R2 + g - (n1-1)g/R1 - (n2-1)g/R2
    = B × (1/R1 + 1/R2) + g × (1 - (n1-1)/R1 - (n2-1)/R2)

Hero width:
  heroWidth = H × heroAR

Perfect fit constraint:
  heroWidth + g + B = W
  H × heroAR + g + B = W

Substitute H:
  [B × (1/R1 + 1/R2) + g × (1 - (n1-1)/R1 - (n2-1)/R2)] × heroAR + g + B = W

Solve for B:
  B × [heroAR × (1/R1 + 1/R2) + 1] = W - g - g × heroAR × (1 - (n1-1)/R1 - (n2-1)/R2)

Let:
  k1 = heroAR × (1/R1 + 1/R2) + 1
  k2 = 1 - (n1-1)/R1 - (n2-1)/R2

Then:
  B = (W - g - g × heroAR × k2) / k1

Finally:
  f = 1 - (B + g) / W = heroWidthFraction
```

## Clamping Strategy

| Calculated f | Action | Expected scaleFactor |
|-------------|--------|---------------------|
| f < 0.30 | Clamp to 0.30 | Slightly > 1.0 |
| 0.30 ≤ f ≤ 0.60 | Use as-is | ≈ 1.0 |
| f > 0.60 | Clamp to 0.60 | Slightly < 1.0 |

When clamping occurs, the layout is still valid - just not perfectly optimized. The hero remains appropriately sized.

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/heroLayout.ts` | Add `calculateOptimalHeroFraction()`, refactor 2-row and 3-row loops to use it |

## Expected Log Output After Change

```text
[Hero] Trying config {rowMode: "2-row", besideCount: 4, optimalFraction: "0.42", clamped: false, scaleFactor: "1.00", accepted: true}
[Hero] Layout complete {finalAspect: "0.85", heroCell: {...}, heroPctOfCanvas: "48.2%", ...}
```

## Future Considerations (Noted for Later)

1. **Multi-hero feasibility detection**: The algorithm could report whether the photo set can support multiple hero zones based on total count and aspect ratio distribution.

2. **Photo selection strategy**: Currently takes first N photos; could later consider aspect ratio variety or color tone alignment for beside zone selection.

3. **Tolerance as crop flexibility**: Rather than rejecting configurations, future versions could apply slight crops to achieve perfect fit.

## Testing Validation

After implementation, test with the same 6-photo set that previously triggered 1-row fallbacks. Expected behavior:
- No more "Fallback triggered: no-valid-config" logs
- `scaleFactor` consistently between 0.95-1.05
- Hero takes 40-55% of canvas area

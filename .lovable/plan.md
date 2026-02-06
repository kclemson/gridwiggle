

# Fix V2 Hero-Side: Copy V1's Algebraic Calculation

## Problem Summary

The V2 `strategyHeroSide` function has two critical flaws:
1. **Hardcoded 0.55 hero width fraction** - ignores photo geometry entirely
2. **Overwrites hero height with beside column height** (line 175) - destroys hero's aspect ratio

## Solution

Copy V1's algebraic hero fraction calculation into V2's math module, then use it in the hero-side strategy. No imports from V1 - V2 will be fully self-contained and V1 can be deleted later.

---

## Technical Changes

### 1. File: `src/lib/v2/math.ts`

Add the algebraic calculation functions from V1 (adapted to V2's `PhotoDimension` type which already has `aspectRatio`):

```typescript
// ============================================================================
// Hero Fraction Calculation
// ============================================================================

interface RowAspectInfo {
  aspectSums: number[];
  photoCounts: number[];
}

/**
 * Calculate aspect sums for each row using the same split logic as packing.
 */
function getRowAspectInfo(photos: PhotoDimension[], rowCount: 1 | 2 | 3): RowAspectInfo {
  // ... copied from V1 heroLayout.ts lines 68-103
}

/**
 * Calculate the heroWidthFraction that produces scaleFactor ≈ 1.0
 * given the specific beside photos and hero aspect ratio.
 * 
 * Mathematical derivation: See V1 heroLayout.ts lines 109-122
 */
export function calculateOptimalHeroFraction(
  heroAspect: number,
  besidePhotos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  rowCount: 1 | 2 | 3,
  minFraction: number = 0.30,
  maxFraction: number = 0.60
): { fraction: number; clamped: boolean } {
  // ... copied from V1 heroLayout.ts lines 123-191
}
```

This requires importing `PhotoDimension` from `./types`.

### 2. File: `src/lib/v2/strategy.ts`

Replace the hardcoded fraction and fix the height override:

**Before (lines 133-140):**
```typescript
const heroWidthFraction = 0.55;
const heroWidth = (canvasWidth - gap) * heroWidthFraction;
const besideWidth = canvasWidth - heroWidth - gap;
const heroHeight = heroWidth / hero.aspectRatio;
```

**After:**
```typescript
// Calculate optimal fraction algebraically (no magic numbers!)
const { fraction } = calculateOptimalHeroFraction(
  hero.aspectRatio,
  besidePhotos,
  canvasWidth,
  gap,
  1  // Single column of beside photos
);

const heroWidth = (canvasWidth - gap) * fraction;
const besideWidth = canvasWidth - heroWidth - gap;
const heroHeight = heroWidth / hero.aspectRatio;
```

**Delete lines 173-175** (the height override bug):
```typescript
// DELETE THESE:
const actualBesideHeight = besideY - gap;
const finalHeroHeight = actualBesideHeight;
```

**Delete lines 207-222** (the equal-height recalculation):
```typescript
// DELETE THESE:
const correctedBesideCells: LayoutCell[] = [];
// ... through line 222
```

**Keep the hero height based on its own aspect ratio** and pack beside photos to match that height properly.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v2/math.ts` | Add `getRowAspectInfo()` and `calculateOptimalHeroFraction()` copied from V1 |
| `src/lib/v2/strategy.ts` | Use algebraic calculation, remove hardcoded 0.55, remove height override |

---

## What Gets Copied from V1

From `src/lib/heroLayout.ts`:
- Lines 60-103: `RowAspectInfo` interface and `getRowAspectInfo()` function
- Lines 123-191: `calculateOptimalHeroFraction()` function

These are pure math functions with no dependencies on V1-specific types or logic. The V2 `PhotoDimension` type already has `aspectRatio` which is all these functions need.

---

## Expected Result

After fix:
- Hero width fraction is calculated from actual photo geometry
- Landscape hero (AR 1.5) gets a landscape cell
- Beside photos match hero height without distorting either
- No magic numbers in the codebase
- V1 can be deleted once V2 is validated


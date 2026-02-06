

# Use Aspect-Ratio-Aware Row Count Selection

## The Problem
The layout algorithm has mathematical functions designed to choose optimal row counts based on hero + beside photo aspect ratios, but they're not being used. Instead, hardcoded thresholds determine row count:
- 8+ beside photos → always try 3 rows first
- 4+ beside photos → always try 2 rows first
- Otherwise → 1 row

This means a landscape hero (AR ~1.5) with 8 portrait beside photos (avg AR ~0.7) gets forced into 3 rows, creating an extremely tall hero unit that pushes the entire collage toward portrait.

## The Fix
Replace the hardcoded thresholds with the existing `calculateOptimalBesideRowCount` function, which uses the formula:

```
optimalRows = √(besideCount × avgBesideAR / heroAR)
```

For a landscape hero (AR 1.5) with 8 portrait photos (avg AR 0.7):
- Current: 3 rows (hardcoded)
- Math: √(8 × 0.7 / 1.5) = √3.7 ≈ **2 rows**

For a portrait hero (AR 0.7) with 8 landscape photos (avg AR 1.5):
- Current: 3 rows (hardcoded)  
- Math: √(8 × 1.5 / 0.7) = √17 ≈ **3 rows** (clamped)

The math naturally adapts to the actual photo shapes.

## Changes

### File: `src/lib/heroLayout.ts`

**Location**: Around lines 619-726 where `buildHeroUnitVariants` determines row modes to try

**Current logic** (simplified):
```typescript
if (besidePhotos.length >= 8) {
  // Try 3 rows first, then 2, then 1
} else if (besidePhotos.length >= 4) {
  // Try 2 rows first, then 1, then 3
} else {
  // Try 1 row first
}
```

**New logic**:
```typescript
import { calculateOptimalBesideRowCount, getPreferredRowModes } from '@/lib/layoutMath';

// Calculate optimal row count based on aspect ratio geometry
const optimalRows = calculateOptimalBesideRowCount(heroAspect, besideDimensions);
const rowModesToTry = getPreferredRowModes(optimalRows);

// Then iterate through rowModesToTry instead of hardcoded order
```

This is approximately a 10-15 line change in one location.

## What We're NOT Changing
- The row-building logic itself (how photos get assigned to rows)
- The scoring/penalty system
- The height budgeting calculations
- The `minPhotosPerRow` parameter (leaving it broken for now)

## Expected Outcome
Landscape heroes should more frequently get 1-2 rows of beside photos instead of always 3, resulting in a shorter hero unit that doesn't force portrait orientation.

## How to Validate
After making this change, upload the same 24-photo test set and observe:
1. Does a landscape hero now get fewer beside rows?
2. Does the overall collage aspect ratio shift toward landscape/square?
3. Check the debug panel to see which row modes are being tried


# Layout Math Module - Implementation Complete ✅

## Summary

Created `src/lib/layoutMath.ts` as a single source of truth for layout math utilities.

### New Module: `src/lib/layoutMath.ts`

Contains:
- **`PhotoDimension`** - Canonical type for layout calculations
- **`shuffleArray`** - Fisher-Yates shuffle
- **`mean`, `variance`, `coefficientOfVariation`** - Statistical utilities
- **`getPhotoDimensions`** - Extract dimensions from PhotoItems
- **`calculateOptimalBesideRowCount`** - Unified formula: `r = √(n × avgBesideAR / heroAR)`
- **`calculateMaxBesideCount`** - Aspect-contrast-aware beside limits
- **`getPreferredRowModes`** - Ordered row mode preferences
- **`calculateAspectContrast`** - Hero vs beside aspect ratio comparison

### Updated Files

| File | Changes |
|------|---------|
| `src/types/collage.ts` | Added `baseMaxBesideFraction`, `minBelowPhotos`, `aspectContrastFloor`, `aspectContrastCap`, `minHeroProminenceRatio` to `LayoutTuning` |
| `src/lib/heroLayout.ts` | Imports from `layoutMath`, removed duplicate code |
| `src/lib/collageLayout.ts` | Imports from `layoutMath`, removed duplicate code |
| `src/lib/layoutBlocks.ts` | Re-exports `PhotoDimension` and `shuffleArray` from `layoutMath` |
| `src/test/layout/layoutAdapter.ts` | Imports from `layoutMath`, removed duplicate code |

### Module Dependency Graph

```text
types/collage.ts (types only)
       ↓
lib/cropUtils.ts (getDisplayCrop)
       ↓
lib/layoutMath.ts (pure math, uses cropUtils for getPhotoDimensions)
       ↓
       ├── lib/collageLayout.ts (scoring, region packing)
       ├── lib/heroLayout.ts (hero layout generation)  
       └── lib/layoutBlocks.ts (block-based layouts)
```

---

## Next Steps

The new mathematical functions in `layoutMath.ts` are now available for use in `heroLayout.ts`:

1. `calculateOptimalBesideRowCount(heroAspect, besidePhotos)` - Determines ideal row count
2. `calculateMaxBesideCount(heroAspect, candidates, totalCount, tuning)` - Determines max beside photos
3. `getPreferredRowModes(optimalRows)` - Returns ordered row modes to try

These can replace hardcoded thresholds in `generateEdgeAnchoredHeroLayout` to achieve truly mathematical structure selection.

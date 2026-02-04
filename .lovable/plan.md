# Hero Photo Layout - IMPLEMENTED ✅

## Status: Complete

The unconstrained anchor-based hero placement system is now implemented.

## Files

### Created: `src/lib/heroLayout.ts`
All hero layout logic:
- `generateAnchorCandidates()` - Grid-based (100px) position generation
- `calculateHeroDimensions()` - Size hero preserving aspect ratio
- `calculateRemainingRegions()` - Compute strips around hero (up to 4)
- `isValidAnchor()` - Single validation: all regions >= 100px
- `selectAnchor()` - Pick from valid candidates
- `placeHeroes()` - Recursive multi-hero placement
- `packStandardsIntoRegions()` - Distribute standards into remaining regions
- `generateHeroLayout()` - Main entry point
- `hasHeroPhotos()` - Check if hero layout should be used

### Updated: `src/lib/collageLayout.ts`
- Added import for hero layout functions
- Routes to `generateHeroLayout()` when heroes detected

## Core Principles Preserved

1. **Heroes anchor anywhere** - corners, edges, floating, center
2. **Single validation rule** - All regions >= 100px in both dimensions
3. **Aspect ratio always preserved** - Hero cells match crop aspect exactly
4. **Grid-based performance** - ~350 candidates, instant validation
5. **No orientation bias** - Math decides validity

## Usage

Photos with `weight >= 2.0` are treated as heroes. Set via `photoWeights` in `LayoutOptions`.

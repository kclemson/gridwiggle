# Layout Row Count: Math-Based Selection (COMPLETED)

## Summary

Unified the 1-row packer with 2/3-row interface and replaced hardcoded threshold with aspect-ratio math for automatic row count selection.

## Changes Made

### 1. `src/lib/heroLayout.ts`
- **Refactored `packBesideAs1Row`**: Changed from height-input to width-input interface, returning full `PackResult1Row` with `combinedHeight` and `naturalTotalWidth`
- **Added `packBesideAs1RowWithHeight`**: Legacy helper for edge-anchored paths that still need height-first logic
- **Updated `calculateOptimalHeroFraction`**: Now accepts `rowCount: 1 | 2 | 3` with special math for 1-row case
- **Updated call sites**: `generateBlockBasedHeroLayout` now passes all three packers

### 2. `src/lib/layoutBlocks.ts`
- **Updated imports**: Added `calculateOptimalBesideRowCount` from layoutMath
- **Updated `HeroUnitOptions`**: Added `maxBeside1Row`, removed `threeRowThreshold`, expanded `rowMode` to include `'1-row'`
- **Added `PackResult1Row`** type
- **Updated `buildHeroUnitBlock`**: Uses `calculateOptimalBesideRowCount(hero.aspectRatio, candidates)` for math-based selection
- **Updated `tryBuildHeroUnit`**: Expanded `rowCount: 1 | 2 | 3`, accepts all three packers

### 3. `src/types/collage.ts`
- **Added `maxBeside1Row`**: Default 4
- **Removed `threeRowThreshold`**: Now determined by math

### 4. `src/components/TuningSection.tsx`
- **Replaced `threeRowThreshold` slider** with `maxBeside1Row` slider

## How Row Count is Selected

The formula `r = √(besideCount × avgBesideAR / heroAR)` naturally selects row count:

| Hero Aspect | Beside Aspect (avg) | Count | Formula | Row Mode |
|-------------|---------------------|-------|---------|----------|
| 1.5 (landscape) | 0.7 (portrait) | 3 | √(3×0.7/1.5) = **1.2** | 1 row |
| 1.5 (landscape) | 0.7 (portrait) | 8 | √(8×0.7/1.5) = **1.9** | 2 rows |
| 0.7 (portrait) | 1.5 (landscape) | 8 | √(8×1.5/0.7) = **4.1** → 3 | 3 rows |
| 1.0 (square) | 1.0 (mixed) | 6 | √(6×1.0/1.0) = **2.4** | 2 rows |

Variety emerges from natural geometric differences in photo sets.

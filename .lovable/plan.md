# Width Estimation Fix — COMPLETED ✓

## Summary

Fixed the geometric estimation error in `calculateBesideCountRange()` that was causing portrait-biased layouts with landscape heroes.

## What Was Fixed

**Location**: `src/lib/v3/feasibility.ts`, lines 235-268

**The Bug**: Used `heroAR` alone to estimate BELOW height, ignoring the width contribution of photos placed beside the hero.

**The Fix**: Now calculates `estimatedHeroRowWidth = heroAR + gap + (besideCount × avgContentAR / rows)` and uses that for BELOW height estimation.

## Test Results

All 23 unit tests pass in `src/test/layout/feasibility.test.ts`.

### Key Improvements Verified

| Hero AR | Photo Count | Before (maxBeside) | After (maxBeside) |
|---------|-------------|-------------------|-------------------|
| 1.5 | 46 | 4-5 | 15 |
| 1.5 | 25 | 3-4 | 15 |
| 2.5 | 46 | 2-4 | 15 |
| 2.5 | 25 | 1-3 | 9 |

### No Regressions

- Portrait heroes (AR 0.6) still allow 10-15 beside photos ✓
- Physical limits respected (can't exceed photo count) ✓
- minBeside/maxBeside ordering preserved ✓

## Files Changed

1. `src/lib/v3/feasibility.ts` — Core fix to width estimation
2. `src/test/layout/feasibility.test.ts` — Comprehensive test matrix

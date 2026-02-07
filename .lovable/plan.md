# Layout Engine Refactoring

## Completed ✓

### 1. DevLogger Simplification
- `'v3'` → `'layout'` 
- `'v3-split'` → `'region'`
- `'v3-ar-budget'` → `'row-pack'`

### 2. Naming Refactor: "Split" → "Region"
- `SplitResult` → `RegionAssignment` (types.ts)
- `findBestSplit()` → `findValidRegionAssignment()` (region-search.ts)
- `scoreSplit()` → `scoreRegionAssignment()` (region-search.ts)
- `validSplits` → `validRegionAssignments` (region-search.ts)
- `splitResult` → `regionAssignment` (intersection.ts)
- `split-search.ts` → `region-search.ts` (file rename)

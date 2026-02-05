# Completed: Remove `targetAspect` and Add Shape-Based Scoring

✅ **Implementation Complete**

This plan has been implemented. The `targetAspect` parameter has been removed from all function signatures and replaced with shape-based direction penalties in the scoring function.

## Changes Made

### `src/lib/collageLayout.ts`
- `scorePartition()`: Now takes `shape` parameter instead of `targetAspect`
- `findBestRowSplit()`: Now takes `shape` parameter instead of `targetAspect`  
- `RegionPackOptions`: `targetAspect` replaced with `shape`
- `packPhotosIntoRegion()`: Uses `shape ?? 'auto'` directly
- `generateCollageLayout()`: Removed `undefined` targetAspect argument

### `src/lib/heroLayout.ts`
- `generateHeroLayout()`: Removed `targetAspect` parameter
- `generateSingleHeroLayout()`: Removed `targetAspect` parameter
- `generateEdgeAnchoredHeroLayout()`: Removed `targetAspect` parameter
- `generateFloatingHeroLayout()`: Removed `targetAspect` parameter
- `calculateHeroWidthFraction()`: Removed `targetAspect` parameter and dead code

### `src/lib/layoutBlocks.ts`
- `buildContentRowsBlock()`: Type signature updated, passes `shape: 'auto'`

## Shape-Based Scoring Logic

```typescript
let directionPenalty = 0;
if (shape === 'portrait' && resultAspect >= 1.0) {
  directionPenalty = 10.0 * (resultAspect - 0.9);
} else if (shape === 'landscape' && resultAspect <= 1.0) {
  directionPenalty = 10.0 * (1.1 - resultAspect);
} else if (shape === 'square') {
  directionPenalty = 5.0 * Math.abs(resultAspect - 1.0);
}
// shape === 'auto' --> directionPenalty = 0 --> no bias
```




# Plan: Add rowHeroAdjacent to Export

## Summary

Add the `rowHeroAdjacent` boolean array to the exported JSON so the AI can reason about which rows were next to the hero when analyzing ratings.

## Changes

### 1. `src/test/layout/types.ts`

Add `rowHeroAdjacent` to the `RatedLayout` interface:

```typescript
export interface RatedLayout {
  // ... existing fields ...
  
  // Layout metrics
  rowCount: number;
  rowSizes: number[];
  rowHeroAdjacent: boolean[];  // NEW: Which rows overlap vertically with hero
  canvasAspect: number;
  // ... rest of fields ...
}
```

### 2. `src/pages/LayoutRating.tsx`

Include `rowHeroAdjacent` when building the `ratedLayout` object:

```typescript
const ratedLayout: RatedLayout = {
  photoCount: currentResult.testCase.photos.length,
  distribution: currentResult.testCase.distribution,
  shape: currentResult.testCase.shape,
  hasHero: currentResult.testCase.hasHero,
  rowCount: currentResult.rowCount,
  rowSizes: currentResult.rowSizes,
  rowHeroAdjacent: currentResult.rowHeroAdjacent,  // NEW
  canvasAspect: currentResult.canvasAspect,
  // ... rest of fields ...
};
```

## Exported JSON Example

Before:
```json
{
  "rowSizes": [5, 4, 4, 6, 5, 6, 5, 5, 5, 5],
  "tags": ["row-too-dense"]
}
```

After:
```json
{
  "rowSizes": [5, 4, 4, 6, 5, 6, 5, 5, 5, 5],
  "rowHeroAdjacent": [true, true, true, false, false, false, false, false, false, false],
  "tags": ["row-too-dense"]
}
```

This makes it clear that rows 0-2 (sizes 5, 4, 4) were packed next to the hero, which is the pattern you're flagging as problematic.

## Files Changed

| File | Change |
|------|--------|
| `src/test/layout/types.ts` | Add `rowHeroAdjacent: boolean[]` to `RatedLayout` interface |
| `src/pages/LayoutRating.tsx` | Include `rowHeroAdjacent` in `ratedLayout` object construction |


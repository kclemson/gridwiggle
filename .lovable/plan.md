
# Fix: Enable Top-Right Hero Position

## The Issue

The `top-right` position is proposed in `hero.ts` but **never gets selected** because:

1. **Scoring is position-blind**: `scoreConfiguration` only considers prominence ratio and area uniformity
2. **Identical geometry**: `top-left` and `top-right` are geometric mirrors - same prominence, same cell sizes
3. **First-wins behavior**: When scores tie, the first proposal (`top-left`) always wins

## The Fix

Add a **random tiebreaker** to the scoring function so equally-valid positions have equal chance of being selected.

## Technical Changes

### File: `src/lib/v3/intersection.ts`

**Lines 407-420** - Add randomization to break ties:

```typescript
function scoreConfiguration(
  prominenceRatio: number,
  cells: LayoutCell[],
  tuning: V3Tuning
): number {
  // Base score from prominence (higher prominence = better)
  const prominenceScore = prominenceRatio / tuning.hero_targetProminence;
  
  // Cell area uniformity (lower variance = better)
  const areas = cells.slice(1).map(c => c.width * c.height);
  const areaUniformity = areas.length > 1 ? 1 / (1 + coefficientOfVariation(areas)) : 1;
  
  // Random tiebreaker for equally-valid configurations (1% variation)
  const randomTiebreaker = Math.random() * 0.01;
  
  return (prominenceScore * 0.6) + (areaUniformity * 0.4) + randomTiebreaker;
}
```

## Why This Works

| Configuration | Base Score | With Tiebreaker |
|--------------|------------|-----------------|
| top-left     | 1.234      | 1.234 + 0.007   |
| top-right    | 1.234      | 1.234 + 0.003   |

The 1% random variation is small enough to never override a genuinely better configuration, but large enough to give equal-scoring positions an equal chance of being selected.

## Expected Outcome

When shuffling, the hero will appear in **both** top-left and top-right positions roughly equally.

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/lib/v3/intersection.ts` | 407-420 | Add `randomTiebreaker` to score calculation |

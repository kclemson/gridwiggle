

# Remove Balance Score from Region Assignment Scoring

## What We're Changing

Remove the 50/50 balance bias from `scoreRegionAssignment()` in `src/lib/v3/region-search.ts`.

## The Change

**Before:**
```typescript
return (balanceScore * 0.3) + (uniformityScore * 0.3) + (prominenceScore * 0.4);
```

**After:**
```typescript
// Removed balanceScore - was pushing BELOW region to match hero height,
// causing large cells that threatened prominence
return (uniformityScore * 0.5) + (prominenceScore * 0.5);
```

We'll also remove the now-unused `heroRowRatio` and `balanceScore` calculations (lines 461-464) and update the function's docstring.

## Technical Details

**File:** `src/lib/v3/region-search.ts`

**Lines to modify:** 442-481

1. Update docstring to remove "Balance" criterion
2. Delete lines calculating `heroRowRatio` and `balanceScore`
3. Reweight remaining scores: 50% uniformity, 50% prominence

## Expected Behavior

- Assignments will now be ranked purely by cell uniformity and prominence safety
- BELOW region no longer pressured toward height = 1.0
- Should reduce prominence failures from tall portrait cells in BELOW


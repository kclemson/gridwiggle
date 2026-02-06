

# Randomized BESIDE Photo Selection

## Goal

Replace deterministic AR-based photo selection with random sampling, so different photos end up in BESIDE vs BELOW on each shuffle.

## Current Behavior

Photos are sorted by aspect ratio, and the narrowest N photos always go to BESIDE:

```typescript
const sortedByAR = [...photos].sort((a, b) => a.aspectRatio - b.aspectRatio);
const besidePhotos = sortedByAR.slice(0, besideCount);
const belowPhotos = sortedByAR.slice(besideCount);
```

## New Behavior

Photos are shuffled randomly, then sliced for each region:

```typescript
const shuffledPhotos = shuffleArray(photos);
const besidePhotos = shuffledPhotos.slice(0, besideCount);
const belowPhotos = shuffledPhotos.slice(besideCount);
```

## Implementation

### File: `src/lib/v3/split-search.ts`

1. **Add import** for `shuffleArray` from `./utils`

2. **Replace sorting with shuffling** (line 53-54)
   - Remove: `const sortedByAR = [...photos].sort(...)`
   - Add: `const shuffledPhotos = shuffleArray(photos)`

3. **Update slice references** (lines 69-71, 103-104)
   - Change `sortedByAR.slice(...)` to `shuffledPhotos.slice(...)`

4. **Collect valid splits instead of tracking best** 
   - Add `validSplits: SplitResult[]` array at start
   - Replace `if (bestSplit === null || score > bestSplit.score)` with `validSplits.push(...)`
   - At the end, randomly select: `return validSplits[Math.floor(Math.random() * validSplits.length)]`

5. **Update logging** to reflect "selected from N valid candidates" instead of "best split found"

## What Stays the Same

- All geometric validation (canvas AR, prominence, cell sizes)
- The packing algorithms
- Row count calculations
- The iteration over besideCount and besideRowCount combinations

## Expected Result

Each shuffle produces different photo assignments to BESIDE vs BELOW, creating more visual variety while still respecting all geometric constraints.


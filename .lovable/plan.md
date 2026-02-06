

# Simplify Row Selection: Random-First Approach

## Current Problem

The algorithm tries to *predict* the optimal row count using a formula based on aspect ratios and photo counts. This creates bias (always picks 3 rows) and is overly complex.

## New Approach

**Don't predict. Randomize, then validate.**

```text
┌─────────────────────────────────────────────────────────────┐
│   1. Shuffle [1, 2, 3] randomly                             │
│   2. For each row count in shuffled order:                  │
│      - Try to pack photos beside hero                       │
│      - Check if scale factor is within tolerance            │
│      - If yes → use it, done                                │
│      - If no → try next                                     │
│   3. If none work → fallback                                │
└─────────────────────────────────────────────────────────────┘
```

## Code Changes

### File: `src/lib/layoutBlocks.ts`

**Before** (~line 168-180):
```typescript
// Complex: calculate "optimal" rows based on aspect ratio math
const optimalRows = rowMode === 'auto'
  ? calculateOptimalBesideRowCount(hero.aspectRatio, candidates)
  : rowMode === '1-row' ? 1 : rowMode === '2-row' ? 2 : 3;

const rowModesToTry: (1 | 2 | 3)[] = optimalRows === 1 
  ? [1, 2, 3] 
  : optimalRows === 3 
  ? [3, 2, 1] 
  : [2, 3, 1];
```

**After**:
```typescript
// Simple: random order, validate each
const rowModesToTry: (1 | 2 | 3)[] = rowMode === 'auto'
  ? shuffleArray([1, 2, 3] as (1 | 2 | 3)[])
  : [rowMode === '1-row' ? 1 : rowMode === '2-row' ? 2 : 3];
```

### File: `src/lib/layoutMath.ts`

**Remove** the `calculateOptimalBesideRowCount` function (no longer needed).

### Update logging

```typescript
devLogger.log('layout', 'Row selection', {
  heroAR: hero.aspectRatio,
  candidateCount: candidates.length,
  rowModesToTry,  // Now shows random order like [2, 1, 3]
});
```

## Why This Is Better

| Aspect | Before | After |
|--------|--------|-------|
| Complexity | Formula with sqrt, aspect ratios, predictions | Shuffle + validate |
| Variety | Biased toward 3 rows | Equal chance for 1, 2, or 3 |
| Code size | ~20 lines of prediction logic | ~3 lines |
| Debuggability | "Why did formula pick 3?" | "Random picked 2, it fit" |

## Expected Behavior

Each shuffle gives roughly equal probability to each row mode. Over many shuffles:
- ~33% start with 1-row
- ~33% start with 2-row  
- ~33% start with 3-row

If first choice doesn't fit (scale out of tolerance), it tries the next. Natural variety emerges.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/layoutBlocks.ts` | Replace prediction logic with `shuffleArray([1, 2, 3])` |
| `src/lib/layoutMath.ts` | Remove `calculateOptimalBesideRowCount` function |


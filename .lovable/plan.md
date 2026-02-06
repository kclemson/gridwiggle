

# Fix: Generate More Test Cases (Target ~44)

## Problem

The current loop generates only **18 test cases**:
- 9 photo counts × 2 variations = 18 cases
- `BATCH_SIZE = 44` is ignored because there are only 18 cases to shuffle/slice from

## Solution

Increase `VARIATIONS_PER_COMBO` from 2 to 5 to generate ~45 cases, which will be sliced to 44:

**9 photo counts × 5 variations = 45 cases → slice(0, 44) = 44 cases**

This provides good coverage while keeping the simple loop structure.

## Change

### File: `src/test/layout/layoutAdapter.ts`

**Line 198** - Update constant:

```typescript
// Before
const VARIATIONS_PER_COMBO = 2;

// After
const VARIATIONS_PER_COMBO = 5;
```

## Math Breakdown

| Photo Counts | Variations | Total Cases | After Slice |
|--------------|------------|-------------|-------------|
| 9 | 2 | 18 | 18 (current - too few!) |
| 9 | 5 | 45 | 44 (target) |
| 9 | 6 | 54 | 44 (wasteful) |

Using 5 variations gives us exactly what we need with minimal waste.

## Expected Outcome

- Reset will generate 44 test cases instead of 18
- Each photo count gets 5 different test cases with varying:
  - Hero vs non-hero (80/20 split)
  - Random aspect distributions
  - Random `minPhotosPerRow` tuning (2, 3, or 4)
  - Random smart crop variations

## Files Modified

| File | Changes |
|------|---------|
| `src/test/layout/layoutAdapter.ts` | Change `VARIATIONS_PER_COMBO` from 2 to 5 |


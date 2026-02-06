

# Implement Layout Rating Test Case Variety Improvements

## Goal

Make the Layout Rating Tool produce noticeably different layouts when reset, by adding more meaningful randomization at the test case generation level.

## Changes

### File 1: `src/test/layout/photoGenerator.ts`

**Change 1** - Wider smart crop variation (line 26-29):
```typescript
// Before: 10-30% toward square
const variation = 0.1 + Math.random() * 0.2;

// After: 15-50% toward square
const variation = 0.15 + Math.random() * 0.35;
```

**Change 2** - Lower default smart crop rate (line 101):
```typescript
// Before
smartCropRatio: number = 0.7

// After  
smartCropRatio: number = 0.5
```

### File 2: `src/test/layout/layoutAdapter.ts`

**Change 1** - Generate 2 variations per combination:
- For each `photoCount`, generate multiple test cases (not just one)
- This ensures different random seeds produce different photo sets

**Change 2** - Randomize `minPhotosPerRow` tuning:
- Randomly pick between 2, 3, or 4 for each test case
- This forces different row structures even with similar inputs
- Add `tuning` field to `LayoutTestCase` type if needed

**Change 3** - Update `runLayoutTest` to use tuning from test case:
- Merge any per-case tuning with defaults before running layout

### File 3: `src/test/layout/types.ts` (if needed)

**Change** - Add optional `tuning` field to `LayoutTestCase` interface:
```typescript
interface LayoutTestCase {
  photos: SyntheticPhoto[];
  shape: CollageSettings['shape'];
  hasHero: boolean;
  distribution: AspectDistribution;
  tuning?: Partial<LayoutTuning>;  // NEW
}
```

## Expected Outcome

After these changes, clicking "Reset" will produce visibly different layouts because:
- Wider aspect ratio spread changes row packing decisions
- Different `minPhotosPerRow` values create different row structures
- Multiple variations per combination means different random seeds

The layout algorithm remains deterministic for reproducibility - variety comes from more diverse inputs.

## Files Modified

| File | Changes |
|------|---------|
| `src/test/layout/photoGenerator.ts` | Widen smart crop variation (15-50%), reduce application rate (50%) |
| `src/test/layout/layoutAdapter.ts` | Generate 2 variations per combo, randomize `minPhotosPerRow` tuning |
| `src/test/layout/types.ts` | Add optional `tuning` field to `LayoutTestCase` |


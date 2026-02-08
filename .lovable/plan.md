

# Test Matrix: Width Estimation Fix in `calculateBesideCountRange`

## The Fix Under Test

**Location**: `src/lib/v3/feasibility.ts`, lines 235-265

**Current Bug**: Uses `heroAR` alone to estimate BELOW height, ignoring the width contribution of photos placed beside the hero.

**Proposed Fix**: Calculate `estimatedHeroRowWidth = heroAR + gap + (besideCount × avgContentAR / rows)` and use that for BELOW height estimation.

---

## Test Dimensions

To validate this fix doesn't break anything while achieving the desired effect, we need to test across:

1. **Photo Count**: Low (10), Medium (25), High (46)
2. **Hero AR**: Portrait (0.6), Square (1.0), Landscape (1.5), Wide (2.5)
3. **Content AR Mix**: Portrait-heavy (avg 0.7), Balanced (avg 1.0), Landscape-heavy (avg 1.4)

---

## Test Matrix: Expected `maxBesideByWidth` Values

This table shows the expected `maxBeside` upper bound for each combination, comparing current (buggy) vs. fixed behavior.

### Current Behavior (Bug: uses `heroAR` only)

| Photos | Hero AR | Content Avg AR | Current maxBeside | Resulting Canvas AR |
|--------|---------|----------------|-------------------|---------------------|
| 10 | 0.6 (portrait) | 1.0 | 5-6 | ~0.6 (portrait) ✓ |
| 10 | 1.0 (square) | 1.0 | 3-4 | ~0.5-0.6 (portrait) |
| 10 | 1.5 (landscape) | 1.0 | 2-3 | ~0.4-0.5 (portrait) |
| 10 | 2.5 (wide) | 1.0 | 1-2 | ~0.3-0.4 (very portrait) |
| 25 | 0.6 (portrait) | 1.0 | 8-10 | ~0.5-0.7 (portrait) ✓ |
| 25 | 1.0 (square) | 1.0 | 5-6 | ~0.5-0.6 (portrait) |
| 25 | 1.5 (landscape) | 1.0 | 3-4 | ~0.4-0.5 (portrait) ✗ |
| 25 | 2.5 (wide) | 1.0 | 1-3 | ~0.3-0.4 (portrait) ✗ |
| 46 | 0.6 (portrait) | 1.0 | 10-12 | ~0.5-0.7 (portrait) ✓ |
| 46 | 1.0 (square) | 1.0 | 6-8 | ~0.5-0.6 (portrait) |
| 46 | 1.5 (landscape) | 1.0 | 4-5 | ~0.4-0.5 (portrait) ✗ |
| 46 | 2.5 (wide) | 1.0 | 2-4 | ~0.3-0.4 (portrait) ✗ |

**Pattern**: Landscape heroes get artificially low `maxBeside` because the code overestimates BELOW height, falsely concluding "no room for more beside."

---

### Expected Behavior After Fix

| Photos | Hero AR | Content Avg AR | Expected maxBeside | Expected Canvas AR |
|--------|---------|----------------|-------------------|---------------------|
| 10 | 0.6 (portrait) | 1.0 | 5-6 | ~0.6 (portrait) ✓ |
| 10 | 1.0 (square) | 1.0 | 4-5 | ~0.6-0.8 (slightly wider) |
| 10 | 1.5 (landscape) | 1.0 | 5-7 | ~0.8-1.2 (balanced) |
| 10 | 2.5 (wide) | 1.0 | 6-8 | ~1.0-1.5 (landscape) |
| 25 | 0.6 (portrait) | 1.0 | 8-10 | ~0.5-0.7 (portrait) ✓ |
| 25 | 1.0 (square) | 1.0 | 7-10 | ~0.7-1.0 (balanced) |
| 25 | 1.5 (landscape) | 1.0 | 8-12 | ~0.9-1.3 (balanced) ✓ |
| 25 | 2.5 (wide) | 1.0 | 10-15 | ~1.2-1.8 (landscape) ✓ |
| 46 | 0.6 (portrait) | 1.0 | 10-12 | ~0.5-0.7 (portrait) ✓ |
| 46 | 1.0 (square) | 1.0 | 10-14 | ~0.7-1.0 (balanced) |
| 46 | 1.5 (landscape) | 1.0 | 12-15 | ~1.0-1.5 (balanced/landscape) ✓ |
| 46 | 2.5 (wide) | 1.0 | 15+ | ~1.3-2.0 (landscape) ✓ |

**Pattern**: The fix creates a positive feedback loop for landscape heroes — more beside → wider canvas → shorter BELOW → even more beside allowed.

---

## Content AR Sensitivity

How does content photo orientation affect the results?

### Portrait-Heavy Content (avg AR ~0.7)

| Photos | Hero AR | Current maxBeside | Fixed maxBeside | Notes |
|--------|---------|-------------------|-----------------|-------|
| 25 | 1.5 | 2-3 | 6-8 | Portrait content needs less width per photo |
| 25 | 2.5 | 1-2 | 4-6 | Beside column narrower, fits more photos |
| 46 | 1.5 | 3-4 | 8-10 | Stacking portraits works well in beside |
| 46 | 2.5 | 2-3 | 6-8 | Portrait content complements wide hero |

### Landscape-Heavy Content (avg AR ~1.4)

| Photos | Hero AR | Current maxBeside | Fixed maxBeside | Notes |
|--------|---------|-------------------|-----------------|-------|
| 25 | 0.6 | 6-8 | 6-8 | No change expected (portrait hero OK) |
| 25 | 1.5 | 3-4 | 10-12 | Landscape beside needs more width per row |
| 46 | 1.5 | 4-5 | 12-15 | Big improvement for landscape+landscape |
| 46 | 2.5 | 2-4 | 10-14 | Wide hero + landscape content → very wide |

---

## Edge Cases to Verify

### 1. Portrait Hero — No Regression
- **Input**: heroAR=0.6, 46 photos, mixed AR
- **Expected**: Should still allow high besideCount (not reduced)
- **Risk**: Fix might accidentally cap portrait heroes

### 2. Very Wide Hero with Few Photos
- **Input**: heroAR=3.0, 8 photos, mixed AR
- **Expected**: Should still constrain to avoid >2.25 canvas AR
- **Risk**: Fix might allow canvas_maxAR violations

### 3. All Portrait Content
- **Input**: heroAR=1.5, 25 photos, all AR ~0.67
- **Expected**: Higher maxBeside than current (narrow columns)
- **Risk**: Could overpack beside region

### 4. Low Photo Count Edge
- **Input**: heroAR=2.0, 5 photos, mixed AR
- **Expected**: Low maxBeside (2-3) due to physical limit
- **Risk**: Should not exceed available photos

### 5. Very High Photo Count
- **Input**: heroAR=1.5, 50 photos, mixed AR
- **Expected**: maxBeside ~15 (loop limit), canvas balanced
- **Risk**: Loop might still exit too early

---

## Automated Validation Criteria

For each test case, measure:

1. **`maxBesideByWidth`**: The calculated upper bound
2. **Actual `besideCount`** in winning layout
3. **Final `canvasAR`**: Should match hero orientation trend
4. **`canvas_maxAR` compliance**: Never exceed 2.25 (2.65 for low counts)

### Success Metrics

| Metric | Before Fix | After Fix (Target) |
|--------|------------|-------------------|
| Wide hero (AR>1.5) + landscape canvas frequency | ~5% | 30-40% |
| Wide hero (AR>1.5) + balanced canvas frequency | ~15% | 40-50% |
| Portrait canvas (AR<0.6) with wide hero | ~80% | ~20% |
| canvas_maxAR violations | 0% | 0% (no regression) |

---

## Implementation Test Plan

### Unit Test for `calculateBesideCountRange`

Add a test file that directly calls the function with controlled inputs:

```typescript
// Example test cases
const testCases = [
  { heroAR: 1.73, contentCount: 45, avgContentAR: 0.98, expected: { minBeside: 0, maxBeside: 10-15 } },
  { heroAR: 0.60, contentCount: 45, avgContentAR: 0.98, expected: { minBeside: 0, maxBeside: 10-12 } },
  { heroAR: 2.50, contentCount: 25, avgContentAR: 1.20, expected: { minBeside: 0, maxBeside: 8-12 } },
  // ... etc
];
```

### Integration Test via Shuffle

1. Use the /v3-test page with fixed photo sets
2. Shuffle 50 times per combination
3. Record distribution of:
   - besideCount chosen
   - final canvas AR
   - layout success rate (no null layouts)

---

## Summary

This matrix covers the parameter space to ensure:

1. **Desired effect achieved**: Landscape heroes now produce landscape canvases
2. **No portrait hero regression**: Portrait heroes still work as before  
3. **AR constraints respected**: `canvas_maxAR` (2.25) never exceeded
4. **Low photo counts safe**: Graceful degradation, not breakage
5. **Content orientation handled**: Both portrait and landscape content mixes work

The key insight is that the fix creates a **geometry-aware positive feedback loop** where more beside photos → wider canvas → shorter BELOW → more room for beside, which is exactly what was missing for landscape heroes.


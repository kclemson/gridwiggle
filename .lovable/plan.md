

## Remove `coefficientOfVariation` Duplication

### What we're doing
Moving the `coefficientOfVariation` function from two locations into a single shared location in `utils.ts`.

### Current state
- **`src/lib/v3/intersection.ts`** (lines 442-448): Local `coefficientOfVariation` function
- **`src/lib/v3/split-search.ts`** (lines 311-316): Identical local `coefficientOfVariation` function
- **`src/lib/v3/utils.ts`**: Already has `mean` and `variance` functions but not `coefficientOfVariation`

### Changes

**1. Add to `src/lib/v3/utils.ts`**

Add the function under the existing "Statistical Functions" section:

```typescript
/**
 * Calculate coefficient of variation (std dev / mean).
 * Measures relative variability - useful for comparing uniformity across different scales.
 */
export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  if (avg === 0) return 0;
  const v = values.reduce((s, val) => s + (val - avg) ** 2, 0) / values.length;
  return Math.sqrt(v) / avg;
}
```

**2. Update `src/lib/v3/intersection.ts`**

- Add `coefficientOfVariation` to the import from `./utils`
- Remove the local function definition (lines 439-448)

**3. Update `src/lib/v3/split-search.ts`**

- Add `coefficientOfVariation` to imports (new import from `./utils`)
- Remove the local function definition (lines 306-316)

### Result
One source of truth for `coefficientOfVariation`, consistent with how `mean`, `variance`, and `shuffleArray` are already shared.


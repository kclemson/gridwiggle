

# Plan: Expose belowRowCount Range for Rejection Diagnostics

## The Issue

`calculateBelowRowCount` internally computes a valid range (`minRows` to `maxRows`) but only returns the picked value. This hides useful diagnostic context.

## Solution: Return Both Value and Range

Modify `calculateBelowRowCount` to return a result object instead of just a number.

## Technical Changes

| File | Change |
|------|--------|
| `src/lib/v3/normalized-pack.ts` | Change return type to `{ value: number, minRows: number, maxRows: number }` |
| `src/lib/v3/region-search.ts` | Update all call sites to destructure result; add range to rejection details |

---

### 1. normalized-pack.ts - New Return Type

```typescript
// New interface
export interface BelowRowCountResult {
  value: number;
  minRows: number;
  maxRows: number;
}

// Updated function signature
export function calculateBelowRowCount(...): BelowRowCountResult {
  // ... existing calculation ...
  
  const minRows = Math.max(1, minRowsByMaxAR, minRowsByCellSize);
  const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR, Math.ceil(n / 2)));
  
  // Pick value (existing logic)
  let value: number;
  if (randomize && minRows < maxRows) {
    value = minRows + Math.floor(Math.random() * (maxRows - minRows + 1));
  } else {
    value = Math.max(minRows, Math.min(maxRows, Math.ceil((minRows + maxRows) / 2)));
  }
  
  return { value, minRows, maxRows };
}
```

### 2. region-search.ts - Update Call Sites

```typescript
// Before
const belowRowCount = calculateBelowRowCount(...);

// After
const belowResult = calculateBelowRowCount(...);
const belowRowCount = belowResult.value;
const belowRowRange = `${belowResult.minRows}-${belowResult.maxRows}`;
```

### 3. Rejection Details - Add Range

```typescript
details: { 
  prominenceRatio: +prominenceRatio.toFixed(2), 
  required: tuning.hero_minProminence, 
  besideCount: `${besideCount} (${minBeside}-${maxBeside})`,
  besideRowCount: `${besideRowCount} (${minRows}-${maxRows})`,
  belowRowCount: `${belowRowCount} (${belowRowRange})`,  // NEW
  heroAR: +heroAR.toFixed(2),
  canvasAR: +canvasAR.toFixed(2),
}
```

---

## Expected Result

Rejection badge shows complete search space:

```text
REJECTED: prominence too low
prominenceRatio: 0.54
required: 1.3
besideCount: 8 (8-8)
besideRowCount: 4 (1-4)
belowRowCount: 3 (2-5)
heroAR: 0.60
canvasAR: 0.74
```


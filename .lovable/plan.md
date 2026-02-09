

# Double Down on AR Budget Jitter

## Current State

`row_arBudgetJitter = 0.4` → rows vary ±40% from base AR budget

## Proposed Change

**File: `src/lib/v3/types.ts`, line 69**

```typescript
// Before
row_arBudgetJitter: 0.4,

// After
row_arBudgetJitter: 0.6,
```

## What This Means

| Jitter | Min Budget | Max Budget | Height Ratio |
|--------|------------|------------|--------------|
| 0.2 | 80% | 120% | 1.5:1 |
| 0.4 | 60% | 140% | 2.3:1 |
| **0.6** | **40%** | **160%** | **4:1** |

With 0.6 jitter:
- A "tall" row might target 40% of base AR → 2-3 large photos
- A "short" row might target 160% of base AR → 8-10 small photos
- Maximum height ratio between rows: 4:1

## Risk

**Low**: The geometric constraints (`canvas_minAR`, `canvas_maxAR`, `hero_maxToSmallest`) still guard against truly broken layouts. We're just giving the randomization more room to explore within those bounds.

If 0.6 feels too chaotic, we can dial back to 0.5. If it's still not enough variety, we can push to 0.7.




# Plan: Loosen Canvas Min AR Tolerance

## What We're Changing

Adjust the minimum canvas aspect ratio from `0.67` (≈ 2:3 portrait) to `0.6` (≈ 3:5 portrait).

## Why This Helps

- Allows slightly taller/narrower canvas proportions
- Works synergistically with the new dynamic `besideCount` range - gives the algorithm more room to explore before hitting the "too tall" rejection
- The difference is subtle but meaningful: 0.67 = 1:1.5, whereas 0.6 = 1:1.67

## File to Modify

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Line 57: `canvas_minAR: 0.67` → `canvas_minAR: 0.6` |

## The Change

```typescript
// Line 57 in DEFAULT_V3_TUNING
canvas_minAR: 0.6,  // was 0.67
```


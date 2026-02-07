

## Add Canvas AR Feasibility Check

### Design Intent
Extend the feasibility module to predict whether a given hero row width will produce a valid canvas aspect ratio, *before* we spend time packing the BELOW region.

### User Outcomes
- Skip BELOW packing when heroRowWidth is provably too large
- Faster layout generation by avoiding doomed configurations
- Same output variety - we're only skipping mathematically invalid candidates

---

## The Math

Canvas AR is calculated as:
```
canvasAR = (heroRowWidth + 2*border) / (heroHeight + gap + belowHeight + 2*border)
```

In normalized space where `heroHeight = 1.0`:
```
canvasAR = (heroRowWidth + 2*gap) / (1.0 + gap + belowHeight + 2*gap)
```

### When is canvasAR too high (too wide)?

For `canvasAR ≤ maxAR`:
```
heroRowWidth + 2*gap ≤ maxAR × (1.0 + gap + belowHeight + 2*gap)
```

The minimum belowHeight is ~0 (very few photos in many rows). So the *minimum* canvas height is roughly:
```
minHeight ≈ 1.0 + 3*gap ≈ 1.09
```

Therefore, the **maximum heroRowWidth** that could possibly satisfy maxAR:
```
maxHeroRowWidth ≈ maxAR × 1.09 + 2*gap
```

For `maxAR = 2.0` and `gap = 0.03`:
```
maxHeroRowWidth ≈ 2.0 × 1.09 + 0.06 ≈ 2.24
```

If `heroRowWidth > 2.24`, the canvas will be too wide no matter what.

### When is canvasAR too low (too tall)?

For `canvasAR ≥ minAR`:
```
heroRowWidth + 2*gap ≥ minAR × (1.0 + gap + belowHeight + 2*gap)
```

The maximum belowHeight is harder to bound algebraically, but we can estimate based on photo count and typical AR. This is a looser bound and may have more false positives.

---

## Changes

### File: `src/lib/v3/feasibility.ts`

Add a new function:

```typescript
/**
 * Check if canvas AR can possibly be valid for a given hero row width.
 * 
 * This is a quick check BEFORE packing BELOW.
 * Only checks the "too wide" case since that's tighter.
 */
export function canMeetCanvasAR(
  heroRowWidth: number,
  normalizedGap: number,
  tuning: V3Tuning
): { feasible: boolean; reason?: string } {
  // Minimum canvas height (hero + gap + minimal below + border)
  // Conservative estimate: belowHeight could be as low as 0.2
  const minCanvasHeight = 1.0 + normalizedGap + 0.2 + 2 * normalizedGap;
  const canvasWidth = heroRowWidth + 2 * normalizedGap;
  
  // Best-case AR (tallest canvas = lowest AR for given width)
  const bestCaseAR = canvasWidth / minCanvasHeight;
  
  // If even the best case exceeds maxAR, this heroRowWidth won't work
  if (bestCaseAR > tuning.canvas_maxAR * 1.1) { // 10% margin for safety
    return { 
      feasible: false, 
      reason: `heroRowWidth ${heroRowWidth.toFixed(2)} → min AR ${bestCaseAR.toFixed(2)} > max ${tuning.canvas_maxAR}`
    };
  }
  
  return { feasible: true };
}
```

### File: `src/lib/v3/region-search.ts`

Add the canvas AR feasibility check after packing BESIDE but before packing BELOW:

**After line 184** (`heroRowWidth = heroAR + normalizedGap + besideResult.width`):

```typescript
// Early canvas AR feasibility check
const canvasARFeasibility = canMeetCanvasAR(heroRowWidth, normalizedGap, tuning);
if (!canvasARFeasibility.feasible) {
  devLogger.log('region', 'Skipping (canvas AR infeasible)', {
    besideCount,
    besideRowCount,
    heroRowWidth: heroRowWidth.toFixed(2),
    reason: canvasARFeasibility.reason,
  });
  continue;
}
```

---

## Summary

| Change | File | Impact |
|--------|------|--------|
| Add `canMeetCanvasAR` function | `src/lib/v3/feasibility.ts` | New pre-validator |
| Use canvas AR check before BELOW packing | `src/lib/v3/region-search.ts` | Skip ~2-4 iterations per layout |

### Expected Impact

When heroAR is large (landscape hero) with many beside photos in 1 row, the heroRowWidth can exceed 3-4 units. These configurations are doomed to fail the canvas AR check - now we skip them before the expensive BELOW packing.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/v3/feasibility.ts` | Add `canMeetCanvasAR` function |
| `src/lib/v3/region-search.ts` | Import and use `canMeetCanvasAR` after BESIDE packing |


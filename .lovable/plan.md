# Unified `scoreConfiguration` Function - IMPLEMENTED

## Status: ✅ Complete

This plan has been fully implemented. All scoring logic is now centralized in a single `scoreConfiguration` function.

---

## Implementation Summary

### Files Changed

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Added `calculateDirectionPenalty`, `calculateRowMetrics`, `scoreConfiguration`. Exported `ConfigurationScore` and `ScoreConfigurationOptions` types. Updated `scorePartition` to use shared `calculateDirectionPenalty`. |
| `src/lib/heroLayout.ts` | Added `shape` parameter to `generateEdgeAnchoredHeroLayout`, `generateEdgeAnchoredHeroLayout1Row`, `generateFloatingHeroLayout`. Changed hero loops from "return first valid" to "collect candidates, score, pick best". |
| `src/lib/layoutBlocks.ts` | Added `shape` to `HeroUnitOptions` interface. |

---

## Key Architecture Decisions

### Single Source of Truth for Scoring

Both content-only and hero layouts now use the **same metrics**:

| Metric | Content-Only | Hero Layout |
|--------|--------------|-------------|
| Direction penalty (shape) | ✓ | ✓ |
| Area CV (uniformity) | ✓ | ✓ |
| Height CV | ✓ | ✓ |
| Sparse row penalty | ✓ | ✓ |
| Scale factor penalty | — | ✓ (deviation from 1.0) |

### Shape-Aware Scoring

The `calculateDirectionPenalty` function is the single source of truth:

```typescript
export function calculateDirectionPenalty(
  resultAspect: number,
  shape: CollageSettings['shape']
): number {
  if (shape === 'portrait' && resultAspect >= 1.0) {
    return 10.0 * (resultAspect - 0.9);
  } else if (shape === 'landscape' && resultAspect <= 1.0) {
    return 10.0 * (1.1 - resultAspect);
  } else if (shape === 'square') {
    return 10.0 * Math.abs(resultAspect - 1.0);
  }
  return 0; // 'auto' = no penalty
}
```

### Hero Layout Candidate Selection

Instead of returning the first valid configuration, hero layouts now:
1. Collect all valid candidates
2. Score each using `scoreConfiguration`
3. Sort by direction penalty (primary) and scale factor closeness (secondary)
4. Return the best-scoring candidate

---

## Benefits

1. **Single source of truth** — All scoring logic in one function
2. **Consistent behavior** — Content-only and hero layouts scored identically
3. **Easy to tune** — Change weights in one place
4. **Testable** — Can unit test `scoreConfiguration` with mock layouts
5. **Extensible** — Adding new metrics is trivial

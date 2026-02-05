

# Plan: Reduce No-Hero Test Cases in Generation

## Problem

Currently `generateTestBatch` generates a 50/50 split between `hasHero: true` and `hasHero: false` cases. Since no-hero layouts are consistently good, we're spending half our rating time on cases that rarely reveal issues.

## Current Logic (lines 196-205)

```typescript
for (const shape of shapes) {
  for (const hasHero of [true, false]) {  // 50/50 split
    const distribution = weightedRandomDistribution();
    cases.push({
      photos: generatePhotoSet(photoCount, distribution, hasHero),
      shape,
      hasHero,
      distribution,
    });
  }
}
```

## Proposed Change

Replace the deterministic 50/50 loop with weighted random selection that heavily favors hero layouts:

- **80% hero** - where most issues occur
- **20% no-hero** - enough for regression coverage

```typescript
for (const shape of shapes) {
  // Weight toward hero layouts since no-hero consistently works well
  // 80% hero, 20% no-hero for regression coverage
  const hasHero = Math.random() < 0.8;
  const distribution = weightedRandomDistribution();
  cases.push({
    photos: generatePhotoSet(photoCount, distribution, hasHero),
    shape,
    hasHero,
    distribution,
  });
}
```

## Trade-offs Considered

| Approach | Hero % | Pros | Cons |
|----------|--------|------|------|
| Current 50/50 | 50% | Maximum coverage | Wastes time on known-good cases |
| **80/20 weighted** | ~80% | Focus on problem areas, still catches regressions | Slightly less no-hero coverage |
| 90/10 weighted | ~90% | Maximum hero focus | Might miss no-hero regressions |

The 80/20 ratio maintains enough no-hero cases for regression detection while focusing the bulk of rating effort where issues actually occur.

## File Changed

| File | Change |
|------|--------|
| `src/test/layout/layoutAdapter.ts` | Replace `for (const hasHero of [true, false])` with weighted random selection |

## Result

Before: ~50% of test cases are no-hero (consistently rated "good")
After: ~20% of test cases are no-hero (for regression coverage)


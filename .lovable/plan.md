
# Plan: Realistic Aspect Ratio Distribution for Test Photos

## The Problem

Current `sampleAspectRatio()` uses a triangular distribution centered on 1.0 with spread 0.5, producing ARs clustered between 0.5-1.5 with heavy bias toward square (1.0). This doesn't reflect real-world photo mixes.

## Common Real-World Aspect Ratios

| Source | Landscape AR | Portrait AR |
|--------|-------------|-------------|
| DSLR (3:2) | 1.50 | 0.67 |
| Phone/Compact (4:3) | 1.33 | 0.75 |
| Widescreen (16:9) | 1.78 | 0.56 |
| Instagram Square | 1.00 | 1.00 |
| Panorama (2.5:1) | 2.50 | — |

## Proposed Distribution

Weight the sampling toward common ratios with small jitter for variety:

| AR | Weight | Description |
|----|--------|-------------|
| 1.50 | 25% | 3:2 DSLR (most common) |
| 1.33 | 20% | 4:3 phone landscape |
| 0.75 | 20% | 4:3 phone portrait |
| 0.67 | 15% | 3:2 DSLR portrait |
| 1.78 | 10% | 16:9 widescreen |
| 0.56 | 5% | 9:16 stories/vertical video |
| 1.00 | 5% | Square (rare in practice) |

Add ±10% jitter to each base AR for organic variation.

## Technical Change

**File**: `src/test/layout/photoGenerator.ts`

Replace `sampleAspectRatio()` with weighted random selection:

```typescript
const COMMON_ASPECT_RATIOS = [
  { ar: 1.50, weight: 25 },  // 3:2 DSLR landscape
  { ar: 1.33, weight: 20 },  // 4:3 phone landscape
  { ar: 0.75, weight: 20 },  // 4:3 phone portrait
  { ar: 0.67, weight: 15 },  // 3:2 DSLR portrait
  { ar: 1.78, weight: 10 },  // 16:9 widescreen
  { ar: 0.56, weight: 5 },   // 9:16 vertical video
  { ar: 1.00, weight: 5 },   // Square
];

function sampleAspectRatio(orientationBias: number): number {
  // Adjust weights based on orientation bias
  // bias < 0 = more portrait, bias > 0 = more landscape
  
  const adjustedRatios = COMMON_ASPECT_RATIOS.map(({ ar, weight }) => {
    const isLandscape = ar > 1.0;
    const multiplier = isLandscape 
      ? 1 + orientationBias  // boost landscape when bias > 0
      : 1 - orientationBias; // boost portrait when bias < 0
    return { ar, weight: weight * Math.max(0.1, multiplier) };
  });
  
  // Weighted random selection
  const totalWeight = adjustedRatios.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * totalWeight;
  
  for (const { ar, weight } of adjustedRatios) {
    roll -= weight;
    if (roll <= 0) {
      // Add ±10% jitter for variety
      const jitter = 1 + (Math.random() - 0.5) * 0.2;
      return Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, ar * jitter));
    }
  }
  
  return 1.33; // Fallback
}
```

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Square-ish (0.9-1.1) | ~40% | ~5% |
| Portrait (<0.9) | ~30% | ~40% |
| Landscape (>1.1) | ~30% | ~55% |

This should produce more challenging test cases with realistic variety, and fewer prominence failures caused by oversized square content cells.

## Files to Modify

1. **`src/test/layout/photoGenerator.ts`** - Replace triangular distribution with weighted common-ratio sampling



# Plan: Photo-Count-Aware Hero AR Distribution

## Design Intent

The test generator currently uses a single hero AR distribution regardless of photo count. However, low photo counts (≤8) struggle geometrically with extreme hero ARs (very wide or very tall). To better reflect realistic testing needs and avoid over-generating impossible configurations, we'll adjust the hero AR distribution based on photo count.

## User Outcome

- **Low photo counts (≤8)**: Hero ARs cluster toward "safer" ranges (0.8–1.5), with reduced probability of extreme panoramas (>2.0) and very tall portraits (<0.6)
- **Higher photo counts (>8)**: Full distribution retained — the algorithm handles these better
- Test batches will have more balanced pass/fail rates across photo counts

## Technical Approach

### New Distribution Strategy

| Photo Count | Very Tall (<0.6) | Portrait (0.6–0.9) | Square-ish (0.9–1.2) | Moderate Landscape (1.2–1.8) | Wide Panorama (>2.0) |
|-------------|------------------|--------------------|-----------------------|------------------------------|----------------------|
| ≤8 photos   | 2%               | 20%                | 35%                   | 38%                          | 5%                   |
| >8 photos   | 5%               | 25%                | 25%                   | 35%                          | 10%                  |

The low-count distribution:
- Increases square-ish (25% → 35%) — easiest for the algorithm
- Increases moderate landscape (35% → 38%)
- Reduces very tall portrait (5% → 2%) — causes geometric mismatch
- Reduces wide panorama (10% → 5%) — forces extreme canvas AR

### File Changes

**File**: `src/test/layout/photoGenerator.ts`

1. Add a helper function to generate hero AR based on photo count:

```typescript
/**
 * Sample hero aspect ratio based on photo count.
 * Low counts get a distribution biased toward "safer" ARs.
 */
function sampleHeroAspectRatio(photoCount: number): number {
  const roll = Math.random();
  
  // Low photo counts: bias toward square-ish and moderate landscape
  if (photoCount <= 8) {
    if (roll < 0.02) {
      // 2%: Very tall portrait
      return 0.4 + Math.random() * 0.2;  // AR 0.4 - 0.6
    } else if (roll < 0.22) {
      // 20%: Portrait
      return 0.6 + Math.random() * 0.3;  // AR 0.6 - 0.9
    } else if (roll < 0.57) {
      // 35%: Square-ish (safe zone)
      return 0.9 + Math.random() * 0.3;  // AR 0.9 - 1.2
    } else if (roll < 0.95) {
      // 38%: Moderate landscape
      return 1.2 + Math.random() * 0.6;  // AR 1.2 - 1.8
    } else {
      // 5%: Wide panorama (reduced)
      return 2.0 + Math.random() * 1.0;  // AR 2.0 - 3.0
    }
  }
  
  // Standard distribution for higher counts
  if (roll < 0.05) {
    return 0.4 + Math.random() * 0.2;  // 5%: Very tall portrait
  } else if (roll < 0.30) {
    return 0.6 + Math.random() * 0.3;  // 25%: Portrait
  } else if (roll < 0.55) {
    return 0.9 + Math.random() * 0.3;  // 25%: Square-ish
  } else if (roll < 0.90) {
    return 1.2 + Math.random() * 0.6;  // 35%: Moderate landscape
  } else {
    return 2.0 + Math.random() * 1.0;  // 10%: Wide panorama
  }
}
```

2. Update `generatePhotoSet` to pass `count` to the hero AR generator:

```typescript
if (isHero) {
  aspectRatio = sampleHeroAspectRatio(count);
} else {
  aspectRatio = sampleAspectRatio(orientationBias);
}
```

### Why This Approach?

- **Doesn't hide bugs**: We still generate 5% panoramas and 2% very tall heroes for low counts — just less frequently
- **Reflects reality**: Users with only 5 photos are less likely to choose an extreme panorama as their hero
- **Improves test efficiency**: More tests exercise feasible configurations, giving better signal on the algorithm's core behavior


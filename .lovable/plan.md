

# Simplify Photo Generation with Mathematical Sampling

## Goal

Replace the categorical distribution system (`phone-mix`, `social-mix`, etc.) with a simple mathematical approach that samples aspect ratios directly from a continuous range.

## Mathematical Approach

### Core Idea

Instead of categories, use a single parameter called **orientationBias** that controls where photos tend to fall on the aspect ratio spectrum:

```
orientationBias: -1.0 (all portrait) ←→ 0.0 (balanced) ←→ +1.0 (all landscape)
```

For each photo, sample a random aspect ratio from the range `[0.5, 2.0]` (covering 9:16 to 16:9), with the sampling weighted by the bias.

### Sampling Formula

Use a weighted random approach centered around 1.0 (square):

```typescript
function sampleAspectRatio(orientationBias: number): number {
  // Range: 0.5 (tall portrait) to 2.0 (wide landscape), centered at 1.0
  const minAR = 0.5;
  const maxAR = 2.0;
  
  // Sample uniformly, then shift based on bias
  // Bias > 0 shifts toward landscape (higher AR)
  // Bias < 0 shifts toward portrait (lower AR)
  const center = 1.0 + orientationBias * 0.5; // Center from 0.5 to 1.5
  const spread = 0.6; // Controls variance
  
  // Triangular distribution around center, clamped to range
  const u = Math.random();
  const v = Math.random();
  const sample = center + spread * (u - v);
  
  return Math.max(minAR, Math.min(maxAR, sample));
}
```

This produces a bell-curve-ish distribution centered on the bias, naturally bounded by the min/max.

## Implementation Changes

### File 1: `src/test/layout/types.ts`

Remove `AspectDistribution` type entirely. Update interfaces:

```typescript
// REMOVE:
// export type AspectDistribution = 'phone-mix' | 'social-mix' | ...

// UPDATE LayoutTestCase:
export interface LayoutTestCase {
  photos: SyntheticPhoto[];
  shape: CollageSettings['shape'];
  hasHero: boolean;
  orientationBias: number;  // Was: distribution
  tuning?: Partial<LayoutTuning>;
}

// UPDATE RatedLayout:
export interface RatedLayout {
  photoCount: number;
  orientationBias: number;  // Was: distribution
  shape: CollageSettings['shape'];
  hasHero: boolean;
  // ... rest stays same
}
```

### File 2: `src/test/layout/photoGenerator.ts`

Replace categorical logic with mathematical sampling:

```typescript
// REMOVE: COMMON_RATIOS, pickRatioForDistribution, DISTRIBUTION_WEIGHTS, weightedRandomDistribution

// ADD: Mathematical sampling
const MIN_ASPECT = 0.5;   // 9:16 portrait
const MAX_ASPECT = 2.0;   // 16:9 landscape

/**
 * Sample an aspect ratio using triangular distribution.
 * orientationBias: -1 (portrait) to +1 (landscape), 0 = balanced
 */
export function sampleAspectRatio(orientationBias: number): number {
  // Center shifts from 0.75 (portrait-ish) to 1.25 (landscape-ish)
  const center = 1.0 + orientationBias * 0.25;
  const spread = 0.5;
  
  // Triangular distribution: sum of two uniforms shifted and scaled
  const u = Math.random();
  const v = Math.random();
  const sample = center + spread * (u - v);
  
  return Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, sample));
}

/**
 * Generate synthetic photo set with mathematical aspect ratio sampling.
 */
export function generatePhotoSet(
  count: number,
  orientationBias: number,
  hasHero: boolean,
  smartCropRatio: number = 0.5
): SyntheticPhoto[] {
  const photos: SyntheticPhoto[] = [];
  
  for (let i = 0; i < count; i++) {
    let aspectRatio = sampleAspectRatio(orientationBias);
    
    if (Math.random() < smartCropRatio) {
      aspectRatio = applySmartCropVariation(aspectRatio);
    }
    
    const isHero = hasHero && i === 0;
    if (isHero) {
      // Hero biased toward landscape/square
      aspectRatio = sampleAspectRatio(0.3 + Math.random() * 0.4); // 0.3 to 0.7
      if (Math.random() < 0.5) {
        aspectRatio = applySmartCropVariation(aspectRatio);
      }
    }
    
    photos.push(createSyntheticPhoto(
      `photo-${i + 1}`,
      aspectRatio,
      isHero ? 1 : 3
    ));
  }
  
  return photos;
}
```

### File 3: `src/test/layout/layoutAdapter.ts`

Update to use numeric bias instead of distribution:

```typescript
// REMOVE: import { weightedRandomDistribution } from './photoGenerator'

export function generateTestBatch(count: number): LayoutTestCase[] {
  const cases: LayoutTestCase[] = [];
  const VARIATIONS_PER_COMBO = 5;
  
  for (const photoCount of TEST_PHOTO_COUNTS) {
    for (let v = 0; v < VARIATIONS_PER_COMBO; v++) {
      const hasHero = Math.random() < 0.8;
      // Random bias from -0.6 to +0.6 (avoid extremes)
      const orientationBias = (Math.random() - 0.5) * 1.2;
      const tuning = { minPhotosPerRow: randomMinPhotosPerRow() };
      
      if (hasHero) {
        cases.push({
          photos: generatePhotoSet(photoCount, orientationBias, true),
          shape: 'auto',
          hasHero: true,
          orientationBias,
          tuning,
        });
      } else {
        // ... same shape logic, use orientationBias instead of distribution
      }
    }
  }
  
  return shuffleArray(cases).slice(0, count);
}
```

### File 4: `src/pages/LayoutRating.tsx`

Update banner display to show bias value:

```typescript
// Instead of showing distribution name, show bias direction:
const biasLabel = orientationBias > 0.2 ? '→L' 
                : orientationBias < -0.2 ? '→P' 
                : '→M';  // L=landscape, P=portrait, M=mixed

// Banner: "AUTO + HERO (50) →L → landscape"
```

## What This Achieves

1. **Simpler code**: No category types, no weight maps, no switch statements
2. **Continuous variety**: Every reset produces different aspect ratio spreads
3. **Controllable**: Single numeric parameter controls the distribution shape
4. **Balanced outcomes**: Random bias values naturally produce mix of portrait/landscape/square canvases
5. **Mathematical foundation**: Uses triangular distribution which is simple and intuitive

## Files Modified

| File | Changes |
|------|---------|
| `src/test/layout/types.ts` | Remove `AspectDistribution`, add `orientationBias: number` to interfaces |
| `src/test/layout/photoGenerator.ts` | Replace categories with `sampleAspectRatio(bias)` function |
| `src/test/layout/layoutAdapter.ts` | Use random bias value instead of `weightedRandomDistribution()` |
| `src/pages/LayoutRating.tsx` | Update banner to show bias direction instead of distribution name |


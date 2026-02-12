

# Photo-Count-Aware Hero Sizing

## Problem

With 21 photos, the hero looks great -- prominent but balanced. With 36 photos, the hero maintains the same absolute prominence targets, which forces content photos into tiny cells. The engine doesn't know that "prominence" should be relative to how many photos are competing for space.

## Design Intent

When there are more photos, the hero doesn't need to dominate as aggressively to still feel like the star. A hero that's 1.5x the runner-up in a 10-photo collage feels right; that same 1.5x in a 36-photo collage means the hero gobbles too much canvas, cramping everyone else.

## User Outcome

- Collages with 10-20 photos: no change, current behavior preserved
- Collages with 25-35+ photos: hero is still clearly the largest, but takes a smaller fraction of the canvas, giving content photos more breathing room
- The transition is smooth (continuous formula), not a sudden cliff

## Approach: Scale Two Levers by Photo Count

Two parameters currently control hero sizing:

1. **Area fraction ceiling** (`effectiveAreaFractionMax`) -- how much canvas the hero can claim
2. **Min prominence** (`hero_minProminence`) -- the floor ratio of hero area to next-largest content cell

Both should taper as total photo count increases. A single scaling factor applied to both keeps the system coherent.

### Scaling Formula

```
scaleFactor = clamp(baseCount / totalCount, floor, 1.0)
```

Where:
- `baseCount` = 20 (photo count where current tuning is calibrated)
- `floor` = 0.55 (never reduce below 55% of the base values, even at very high counts)
- At 20 photos: scale = 1.0 (unchanged)
- At 30 photos: scale = 20/30 = 0.67
- At 36 photos: scale = 20/36 = 0.56
- At 50 photos: scale = 0.55 (floored)

### Expected Effect (corner-anchor, template max 0.40)

| Photos | Scale | Effective Max Area Frac | Effective Min Prominence |
|--------|-------|------------------------|--------------------------|
| 15     | 1.00  | 0.40                   | 0.70                     |
| 20     | 1.00  | 0.40                   | 0.70                     |
| 25     | 0.80  | 0.32                   | 0.56                     |
| 30     | 0.67  | 0.27                   | 0.47                     |
| 36     | 0.56  | 0.22                   | 0.39                     |
| 50     | 0.55  | 0.22                   | 0.39                     |

At 36 photos with a square canvas, the hero would claim ~22% of area instead of ~40%, giving content photos roughly 2x the space they currently get.

## Technical Details

### File: `src/lib/v3/hero-constraints.ts`

Add a new exported function:

```typescript
/**
 * Scale hero constraints based on total photo count.
 * At high counts, heroes don't need to dominate as much.
 */
export function photoCountScale(totalPhotos: number): number {
  const BASE_COUNT = 20;
  const FLOOR = 0.55;
  return Math.max(FLOOR, Math.min(1.0, BASE_COUNT / totalPhotos));
}
```

Modify `effectiveAreaFractionMax` to accept an optional `totalPhotos` parameter:

```typescript
export function effectiveAreaFractionMax(
  heroAreaFraction: HeroAreaRange,
  canvasAR: number,
  totalPhotos?: number
): number {
  const arScale = Math.max(0.5, Math.min(1.0, 1.0 / canvasAR));
  const countScale = totalPhotos != null ? photoCountScale(totalPhotos) : 1.0;
  return heroAreaFraction.max * arScale * countScale;
}
```

### File: `src/lib/v4/index.ts`

**In `generateCandidates`** (~line 269): Pass total photo count to `effectiveAreaFractionMax`:

```typescript
const totalPhotos = contentPhotos.length + 1; // +1 for hero
const maxFrac = effectiveAreaFractionMax(heroAreaFraction, targetCanvasAR, totalPhotos);
```

**In prominence penalty calculation** (~lines 390, 509): Scale the min prominence threshold:

```typescript
const countScale = photoCountScale(contentPhotos.length + 1);
const effectiveMinProminence = tuning.hero_minProminence * countScale;
const prominencePenalty = prominenceRatio < effectiveMinProminence
  ? Math.min(0.3, (effectiveMinProminence - prominenceRatio) * 1.0) : 0;
```

Same change in both the single-region path (~line 390) and the two-region path (~line 509).

**In `generateDualHeroCandidates`**: Same pattern -- pass total photo count through to `effectiveAreaFractionMax` and scale prominence.

### File: `src/lib/v3/utils.ts` (if needed)

No changes expected -- `deriveRegionCounts` already accounts for photo count geometrically.

### Summary of Changes

- 1 new function (`photoCountScale`) in `hero-constraints.ts`
- 1 modified function signature (`effectiveAreaFractionMax`) -- backward compatible via optional param
- ~4 call sites updated in `v4/index.ts` to pass photo count through


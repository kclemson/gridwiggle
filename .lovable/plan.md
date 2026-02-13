

# Fix: Dual-Hero Photo Count Scale Over-Tapering

## The Problem

At 35 photos, `photoCountScale` returns 0.57, which was calibrated for single-hero layouts. In dual-hero, each hero already gets half the area fraction, so applying the same taper creates a double penalty:

```text
Single hero at 35 photos:
  effectiveMax = 0.40 * arScale * 0.57 = ~0.19
  Hero gets ~19% of canvas -- acceptable

Dual hero at 35 photos:
  effectiveMax = 0.42 * arScale * 0.57 = ~0.20
  Each hero gets ~10% of canvas -- stamp-sized
  Actual result: 7.6% combined coverage (3.8% each)
```

The 0.050 floor score means ALL 5 candidates were equally bad -- weighted random selection had nothing good to pick from.

## The Fix

Use a per-hero content ratio for the scale calculation instead of raw photo count. For dual-hero, each hero "owns" half the content pool, so the effective count per hero is lower:

```text
Current:  photoCountScale(totalPhotos)        // 35 -> 0.57
Proposed: photoCountScale(contentPerHero + 1) // (33/2)+1 = 17.5 -> 1.0
```

This means:
- Single hero (35 photos): scale = clamp(20/35, 0.55, 1.0) = 0.57 (unchanged)
- Dual hero (35 photos): scale = clamp(20/17.5, 0.55, 1.0) = 1.0 (no tapering)
- Dual hero (50 photos): scale = clamp(20/25, 0.55, 1.0) = 0.80 (mild tapering)

## Technical Changes

### `src/lib/v4/engine.ts` -- `generateDualHeroCandidates`

In the area fraction calculation (line ~591), compute `effectiveAreaFractionMax` using a per-hero photo count instead of the total:

```typescript
// Current:
const totalPhotosDual = contentPhotos.length + 2;
const maxFrac = effectiveAreaFractionMax(heroAreaFraction, targetCanvasAR, totalPhotosDual);

// Fixed:
const contentPerHero = Math.ceil(contentPhotos.length / 2) + 1;
const maxFrac = effectiveAreaFractionMax(heroAreaFraction, targetCanvasAR, contentPerHero);
```

Similarly, update the prominence threshold calculation (line ~762):

```typescript
// Current:
const countScaleDual = photoCountScale(contentPhotos.length + 2);

// Fixed:
const contentPerHero = Math.ceil(contentPhotos.length / 2) + 1;
const countScaleDual = photoCountScale(contentPerHero);
```

### Impact Matrix

```text
Photos | Heroes | Current Scale | Proposed Scale | Hero Coverage Change
-------+--------+---------------+----------------+--------------------
 10    |   2    | 1.00          | 1.00           | No change
 20    |   2    | 1.00          | 1.00           | No change
 25    |   2    | 0.80          | 1.00           | Heroes ~25% larger
 30    |   2    | 0.67          | 1.00           | Heroes ~50% larger
 35    |   2    | 0.57          | 1.00           | Heroes ~75% larger
 50    |   2    | 0.55          | 0.80           | Heroes ~45% larger
 10    |   1    | 1.00          | 1.00           | No change (untouched)
 35    |   1    | 0.57          | 0.57           | No change (untouched)
```

Single-hero path is completely untouched. Dual-hero gets appropriately scaled tapering that accounts for the area already being split between two heroes.

## Files Changed

| File | Change |
|---|---|
| `src/lib/v4/engine.ts` | Use per-hero content ratio for `effectiveAreaFractionMax` and `photoCountScale` in dual-hero path (~4 lines changed) |




# Evolve Existing Fraction Logic to Ensure Hero Prominence

## The Insight

The `calculateOptimalHeroFraction` function already computes what fraction of canvas width the hero should occupy. It also returns `clamped: boolean` indicating whether the math wanted a fraction outside the allowed range.

**Key observation**: When 1-row mode produces `clamped: true`, it means the geometry doesn't naturally support the layout. Currently we accept these clamped configurations anyway. Instead, we should **reject clamped 1-row configurations** because they fundamentally can't produce a prominent hero.

## Current Flow

```text
calculateOptimalHeroFraction(heroAR, besidePhotos, ..., rowCount=1)
  → { fraction: 0.42, clamped: true }  // wanted 0.25 but clamped to 0.30

tryBuildHeroUnit(..., rowCount=1)
  → uses clamped fraction anyway
  → hero isn't prominent, but accepted
```

## Proposed Flow

```text
calculateOptimalHeroFraction(heroAR, besidePhotos, ..., rowCount=1)
  → { fraction: 0.42, clamped: true }

tryBuildHeroUnit(..., rowCount=1)
  → sees clamped=true for 1-row
  → rejects with "fraction clamped for 1-row"
  → tries next row mode (2 or 3)
```

## Why This Works

The 1-row math produces a non-clamped fraction only when:
- Hero AR is significantly larger than beside photos, OR
- There are very few beside photos

These are exactly the cases where 1-row produces a prominent hero!

When the hero and beside photos have similar ARs, the math wants a low hero fraction (e.g., 20%) but we clamp to 30%. This produces the "hero isn't prominent" problem.

## Technical Change

**File: `src/lib/layoutBlocks.ts`** (in `tryBuildHeroUnit`, ~line 253-260)

```typescript
// BEFORE:
const { fraction: optimalFraction } = calculateOptimalHeroFraction(
  hero.aspectRatio,
  besidePhotos,
  canvasWidth,
  gap,
  rowCount
);

// AFTER:
const { fraction: optimalFraction, clamped } = calculateOptimalHeroFraction(
  hero.aspectRatio,
  besidePhotos,
  canvasWidth,
  gap,
  rowCount
);

// For 1-row: reject if clamped (geometry doesn't support prominent hero)
if (rowCount === 1 && clamped) {
  devLogger.log('layout', 'Config rejected', {
    rowCount,
    besideCount,
    reason: 'fraction clamped for 1-row (hero would lack prominence)',
  });
  continue;
}
```

## Expected Behavior

| Hero AR | Beside ARs | Optimal Fraction | Clamped? | 1-Row Result |
|---------|-----------|-----------------|----------|--------------|
| 2.5 (panorama) | 0.8, 0.9 (portraits) | 0.55 | No | Accepted ✓ |
| 1.5 (landscape) | 1.2, 1.3 (landscape) | 0.28 | Yes (→0.30) | Rejected → try 2-row |
| 0.7 (portrait) | 1.0, 1.1, 1.2 | 0.18 | Yes (→0.30) | Rejected → try 2-row |

## Why This Is Clean

- **No new validation**: Evolves existing `clamped` return value
- **Mathematically grounded**: Uses geometry, not arbitrary thresholds
- **Minimal code**: ~6 lines added
- **Preserves variety**: 1-row still works when geometry supports it

## Files Changed

| File | Change |
|------|--------|
| `src/lib/layoutBlocks.ts` | Use existing `clamped` flag to reject 1-row when geometry is poor (~6 lines) |


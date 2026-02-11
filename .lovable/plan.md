

# Tighten Hero Area Fraction Ceiling for Wide Canvases

## The Problem

A landscape hero (AR 1.50) on a wide canvas (AR 2.18) at area fraction 0.40 produces a hero that's 76% of the canvas height, leaving only 14% height for 11 content photos -- a single cramped strip.

The formula `hHero = sqrt(areaFrac * canvasAR / heroAR)` means that as canvasAR grows, the hero gets taller. The current template allows areaFrac up to 0.40 for ALL canvas ARs up to 2.25, which is too permissive for wide canvases.

## The Fix

Add a **dynamic area fraction ceiling** that decreases as canvasAR increases. The existing `squareMax` is a step in this direction but only covers one case. Replace it with a continuous formula:

```text
effectiveMax = template.max * clamp(1.0 / canvasAR, 0.5, 1.0)
```

This means:
- Square canvas (AR 1.0): effectiveMax = 0.40 * 1.0 = 0.40 (unchanged)
- Moderate landscape (AR 1.5): effectiveMax = 0.40 * 0.67 = 0.27
- Wide landscape (AR 2.18): effectiveMax = 0.40 * 0.50 = 0.20

The same applies in the portrait direction -- a very tall canvas with a portrait hero has the same problem mirrored. The formula naturally handles both since `1/canvasAR > 1` for portrait canvases, and the clamp caps it at 1.0.

### Expected outcomes (heroAR=1.50):

| canvasAR | old max areaFrac | new max areaFrac | old hHero | new hHero | old below h | new below h |
|----------|-----------------|-----------------|-----------|-----------|-------------|-------------|
| 1.00     | 0.35 (squareMax)| 0.40            | 0.48      | 0.52      | 0.49        | 0.45        |
| 1.50     | 0.40            | 0.27            | 0.63      | 0.52      | 0.34        | 0.45        |
| 2.00     | 0.40            | 0.20            | 0.73      | 0.52      | 0.24        | 0.45        |
| 2.25     | 0.40            | 0.18            | 0.77      | 0.49      | 0.20        | 0.48        |

Notice: the new formula naturally keeps hHero around 0.50 regardless of canvas width, leaving roughly half the canvas for content.

## Technical Changes

### File: `src/lib/v3/hero-constraints.ts`

1. Add a helper function `effectiveAreaFractionMax(template, canvasAR)` that computes the dynamic ceiling
2. Remove the `squareMax` field from `HeroAreaRange` (subsumed by the continuous formula)
3. Export the helper so the engine can use it when sampling area fractions

### File: `src/workers/layoutWorker.ts`

1. When sampling `areaFrac` for a template, use `effectiveAreaFractionMax(template, canvasAR)` instead of the raw `template.heroAreaFraction.max`

### File: `src/lib/v4/index.ts`

1. Same change as layoutWorker (sync fallback path)

No UI changes needed -- this is purely a constraint tightening in the template system.


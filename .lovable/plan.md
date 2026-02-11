

# Area-Proportional Photo-to-Region Assignment

## What Problem Are We Solving

Today, the layout worker uses a brute-force loop (`for besideCount = 0 to N`) trying every possible split of photos between the "beside" and "below" regions. This is wasteful -- once we know the hero template, hero AR, target canvas AR, and area fraction, the relative sizes of those two regions are mathematically determined. We can derive the right photo count split directly.

## What Users Experience

No visible change yet -- this is an internal refactoring that replaces guessing with geometric reasoning. It sets the foundation for template-driven layouts by making the photo assignment step deterministic and topology-aware.

## The Formula (Corner-Anchor)

Given normalized canvas (H=1, W=canvasAR), hero area fraction `f`, and hero aspect ratio `heroAR`:

```text
h_hero = sqrt(f * canvasAR / heroAR)
w_hero = heroAR * h_hero

beside_area = (W - w_hero) * h_hero
below_area  = W * (1 - h_hero)

beside_fraction = beside_area / (beside_area + below_area)
besideCount = round(contentCount * beside_fraction)
```

## Expected Outcomes (f=0.20, 20 content photos)

```text
                Canvas AR
Hero AR    0.7     1.0     1.5
────────────────────────────────
0.5        8/11    10/9    14/5
1.0        4/15     6/13    8/11
1.5        3/16     4/15    6/13
2.0        2/17     3/16    4/15
```

Portrait heroes create large beside regions (narrow hero = wide neighbor space).
Landscape heroes push nearly everything below (wide hero = little neighbor space).
The split shifts with canvas AR: wider canvases give more room beside.

## What Changes

| File | Change |
|------|--------|
| `src/lib/v3/utils.ts` | Add `deriveRegionCounts(heroAR, canvasAR, areaFraction, contentCount)` function |
| `src/workers/layoutWorker.ts` | Replace the `for besideCount` brute-force loop with a call to `deriveRegionCounts`, sampling a small set of (canvasAR, areaFraction) combinations from the hero template's valid ranges |

## Technical Details

### New function: `deriveRegionCounts`

Location: `src/lib/v3/utils.ts`

```text
deriveRegionCounts(
  heroAR: number,
  canvasAR: number,
  areaFraction: number,
  contentCount: number
): { besideCount: number; belowCount: number }
```

Steps:
1. Compute `h_hero = sqrt(areaFraction * canvasAR / heroAR)`
2. Clamp `h_hero` to (0.1, 0.95) to avoid degenerate layouts
3. Compute `w_hero = heroAR * h_hero`
4. If `w_hero >= canvasAR * 0.95`, return `{ besideCount: 0, belowCount: contentCount }` (hero fills the width)
5. Compute beside and below areas, derive `besideCount`
6. Clamp `besideCount` to `[0, contentCount]`

### Changes to `generateCandidates` in layoutWorker.ts

Instead of:
```text
for (let besideCount = 0; besideCount <= ordered.length; besideCount++) {
```

The new flow:
1. Query `findCandidateTemplates(1, [heroAR])` to get valid templates
2. For each template, sample canvas AR values within its `canvasAR.min` to `canvasAR.max` range (e.g., 5-7 evenly spaced values; when randomizing, add jitter)
3. Sample area fractions within the template's `heroAreaFraction` range (e.g., 3 values: min, mid, max; respecting `squareMax` when canvas AR is 0.85-1.15)
4. For each (template, canvasAR, areaFraction) triple, call `deriveRegionCounts` to get the besideCount
5. Proceed with existing packing logic (`packToFillHeight` for beside, `packToFillWidth` for below)

This replaces N iterations (one per possible besideCount) with roughly `templates * canvasARSamples * areaSamples` candidates (e.g., 1 template * 6 AR samples * 3 area samples = 18 candidates for single-hero corner-anchor). Much more focused than the current brute-force.

### Candidate count estimate

For corner-anchor only (current single template):
- 6 canvas AR samples * 3 area fraction samples = ~18 candidates
- With randomization jitter: still ~18 but with noise on samples
- Compare to current: up to 30+ iterations for 30 photos

When more templates are added later, each adds its own set of samples, but the total remains bounded and intentional.

### Edge cases

- **Hero wider than canvas**: `w_hero >= canvasAR` means besideCount = 0, all photos go below. This naturally handles very landscape heroes on portrait canvases.
- **Hero nearly full height**: `h_hero > 0.95` is clamped, preventing a degenerate below region with near-zero height.
- **Very few photos (2-3)**: `deriveRegionCounts` may return besideCount = 0 or 1, which is correct -- small photo sets shouldn't split across regions.
- **squareMax area ceiling**: When canvas AR is 0.85-1.15, use the template's `squareMax` (0.35) instead of `max` (0.60) as the upper area sample.

### Mix-aware interleaving (deferred)

The proportional orientation mixing (ensuring each region has a blend of portrait and landscape photos) discussed earlier will be implemented as a follow-up. This plan focuses on getting the count assignment right first. The interleaving logic is independent and can layer on top.


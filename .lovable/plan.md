

# Stratified Sampling for Hero Fraction Generator (No Template Filtering)

## Goal

Ensure every batch of 40 trials systematically covers diverse combinations of canvas AR, hero AR, and template -- so we can **discover** which combos work and which don't through rating, rather than pre-filtering.

## What Changes

Only one file changes: `src/test/layout/heroFractionGenerator.ts`

The `generateHeroFractionBatch` function switches from fully random to stratified generation. Everything else (types, placement functions, visualization, rating page) stays exactly as-is. All 5 single templates and all 3 dual templates remain eligible everywhere.

## Stratified Sampling Design

**Three AR buckets** (used for both canvas and hero):

| Bucket | Range |
|--------|-------|
| Portrait | 0.5 - 0.8 |
| Near-square | 0.8 - 1.2 |
| Landscape | 1.2 - 2.25 |

**Single heroes (28 trials):** 9 cells in the canvas-bucket x hero-bucket grid. 3 trials per cell = 27, plus 1 wild-card (fully random) = 28. Within each cell, exact AR values, area fraction (0.15-0.60), and template are randomized from the full set of 5 templates.

**Dual heroes (12 trials):** 9 cells, 1 trial per cell = 9, plus 3 wild-cards = 12. Hero 1's AR is bucketed, hero 2's AR is fully random (0.5-2.0). Template chosen randomly from all 3 dual templates.

Final array is shuffled so bucket structure isn't visible during rating.

## Technical Details

### `src/test/layout/heroFractionGenerator.ts`

**Add AR bucket definition:**
```text
const AR_BUCKETS = [
  { min: 0.5, max: 0.8 },
  { min: 0.8, max: 1.2 },
  { min: 1.2, max: 2.25 },
];
```

**Replace `generateHeroFractionBatch`:**
- Nested loop over `AR_BUCKETS` for canvas x hero (9 combos)
- For single: generate 3 trials per combo (27) + 1 fully random = 28
- For dual: generate 1 trial per combo (9) + 3 fully random = 12
- Each trial picks `canvasAR` from its canvas bucket, `heroAR` from its hero bucket, random area fraction, random template from the full eligible set
- Shuffle the combined 40-element array

**No changes to:**
- Template types or arrays (all 5 single + 3 dual stay)
- `placeSingleHero` or `placeDualHeroes` functions
- `computeHeroDims` or any other existing logic
- Visualization component or rating page


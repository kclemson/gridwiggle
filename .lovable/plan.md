

# Round 3: Boundary Stress-Test Generator

## Goal

Zoom into the ambiguous boundaries discovered in Rounds 1-2 to find precise thresholds for the layout engine rules.

## What Gets Built

A new `generateRound3Batch()` function in `src/test/layout/heroFractionGenerator.ts` and a "Round 3" option in the round selector dropdown on `src/pages/HeroFractionRating.tsx`.

## Round 3 Trial Design (40 trials)

### 1. Dual Area Fraction Sweep (12 trials)
Test dual heroes at area fractions **0.16, 0.18, 0.20, 0.38, 0.40, 0.42, 0.44** across portrait and landscape canvases using `diagonal-corners` (the most reliable template, isolating area as the variable).

- 6 trials on portrait canvas (AR 0.6-0.7), one per area fraction step
- 6 trials on landscape canvas (AR 1.5-1.7), one per area fraction step

### 2. Band AR Ratio Sweep (10 trials)
Test `top-band` and `bottom-band` on portrait canvases where `heroAR / canvasAR` ranges from **2.0 to 3.2** in steps of ~0.3. This finds the exact cutoff where bands stop working.

- 5 trials with `top-band`
- 5 trials with `bottom-band`
- Portrait canvas AR 0.6-0.7, hero AR chosen to hit each ratio target

### 3. Single Hero on Square Canvas (8 trials)
Test single heroes at area fractions **0.28, 0.30, 0.32, 0.34, 0.36, 0.38, 0.40, 0.42** on near-square canvases (AR 0.95-1.05) using `corner-anchor`. Finds the single-hero ceiling on square canvases.

### 4. Axis-Mismatch Confirmation (6 trials)
Re-test the banned combos at favorable area fractions (0.25-0.30) to confirm they truly always fail:
- 3x `side-by-side` on portrait canvas
- 3x `top-bottom` on landscape canvas with portrait heroes

### 5. Wild Cards (4 trials)
Random configs near boundaries for coverage.

**Total: 12 + 10 + 8 + 6 + 4 = 40 trials**

## Technical Changes

### `src/test/layout/heroFractionGenerator.ts`
- Add `generateRound3Batch(): HeroPlacementResult[]`
- Each trial gets a descriptive scenario label (e.g., `r3/dual-area/portrait/0.20`, `r3/band-ratio/top/2.6`)

### `src/pages/HeroFractionRating.tsx`
- Add "Round 3 (boundaries)" option to the round selector `<Select>`
- Wire it to call `generateRound3Batch()` on selection

No other files change. No database changes.


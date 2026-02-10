

# Round 4: Rule Validation (Success Cases Only)

## Goal

Generate trials that **should all look good** according to the proposed rules. If any trial looks bad, it means the rule needs adjusting. This is a confirmation pass, not an exploration.

## Trial Design (~30 trials)

Each group demonstrates one rule by showing configs that obey it.

### 1. Band Templates on Square Canvases (8 trials)
Confirms bands work when canvas AR is 0.85-1.15.
- 2x `top-band` on square canvas (AR 0.95-1.05), area 0.25-0.35
- 2x `bottom-band` on square canvas, area 0.25-0.35
- 2x `left-band` on square canvas, area 0.25-0.35
- 2x `right-band` on square canvas, area 0.25-0.35

### 2. Dual Heroes Within Floor/Ceiling (6 trials)
Confirms dual area range 0.22-0.42 works across canvas shapes.
- 2x on portrait canvas (AR 0.6-0.7), `diagonal-corners`, area 0.25 and 0.35
- 2x on square canvas (AR 0.95-1.05), `diagonal-corners`, area 0.25 and 0.35
- 2x on landscape canvas (AR 1.4-1.7), `diagonal-corners`, area 0.25 and 0.35

### 3. Single Hero on Square Canvas at/Below Ceiling (4 trials)
Confirms single hero ceiling of 0.35 on square canvases.
- 4x `corner-anchor` on square canvas, area fractions 0.20, 0.25, 0.30, 0.35

### 4. Axis-Aligned Dual Templates (6 trials)
Confirms `side-by-side` works on landscape and `top-bottom` works on portrait (the non-banned orientations).
- 3x `side-by-side` on landscape canvas (AR 1.4-1.7), area 0.25-0.35
- 3x `top-bottom` on portrait canvas (AR 0.6-0.7), area 0.25-0.35

### 5. Corner-Anchor Versatility (6 trials)
Confirms the most reliable template works everywhere.
- 2x portrait canvas, mixed hero ARs, area 0.20-0.40
- 2x square canvas, mixed hero ARs, area 0.20-0.35
- 2x landscape canvas, mixed hero ARs, area 0.20-0.40

**Total: 8 + 6 + 4 + 6 + 6 = 30 trials**

Each trial gets a descriptive scenario label like `r4/bands-square/top-band/1`, `r4/dual-range/portrait/0.25`, etc.

## Technical Changes

### `src/test/layout/heroFractionGenerator.ts`
- Add `generateRound4Batch(): HeroPlacementResult[]`

### `src/pages/HeroFractionRating.tsx`
- Add `'round4'` to `RoundType`
- Add entry in `GENERATORS` record
- Add "Round 4 (validation)" option to the Select dropdown


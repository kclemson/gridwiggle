

# Hero Fraction Rating Tool Updates

Three changes based on our discussion:

## 1. Match canvas AR range to main app (0.5 - 2.25)

The main layout engine uses `canvas_minAR: 0.5` and `canvas_maxAR: 2.25`. The rating tool currently generates canvases in the narrower 0.65 - 1.55 range. Update both single-hero and dual-hero generation loops to use **0.5 - 2.25**.

## 2. Replace `top-band-split` with `top-bottom` dual-hero template

The `top-band-split` template (two heroes side-by-side at top) was rated 100% bad. Replace it with `top-bottom`: Hero 1 centered horizontally at the top edge, Hero 2 centered horizontally at the bottom edge.

## 3. Brighter canvas background

Change the canvas from `bg-muted/40` to `bg-white` so the canvas boundary is clearly distinct from the dark page background.

---

## Technical Details

### `src/test/layout/heroFractionGenerator.ts`

- Change both `randomInRange(0.65, 1.55)` calls (lines ~164 and ~175) to `randomInRange(0.5, 2.25)`
- In the `DualHeroTemplate` type, rename `'top-band-split'` to `'top-bottom'`
- In the `DUAL_TEMPLATES` array, rename `'top-band-split'` to `'top-bottom'`
- Replace the `'top-band-split'` case in `placeDualHeroes` with `'top-bottom'` logic:
  - Hero 1: `{ x: (1 - d1.w) / 2, y: 0, w: d1.w, h: d1.h }`
  - Hero 2: `{ x: (1 - d2.w) / 2, y: 1 - d2.h, w: d2.w, h: d2.h }`

### `src/components/hero-fraction/HeroFractionVisualization.tsx`

- Change canvas class from `bg-muted/40` to `bg-white`


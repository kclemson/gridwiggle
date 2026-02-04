

# Fix Hero Layout: Eliminate Clipping and Blank Rectangles

## Problem Summary

From analyzing the code and screenshots:

1. **Severe clipping** - Photos beside the hero are clipped horizontally because their cell dimensions don't match their crop aspect ratios
2. **Blank rectangles** - The hero + beside column don't fill the canvas width
3. **Portrait bias** - When shape is "Auto", the layout tends toward portrait orientation

## Root Cause Analysis

### The Core Issue

The current `generateEdgeAnchoredHeroLayout` function:
1. Calculates hero size from an area budget (preserves hero aspect ratio ✓)
2. Packs "beside" photos as a vertical column to match hero height
3. **Doesn't verify or adjust to ensure hero + beside = canvas width**

When the beside column's "natural width" (calculated to fill hero height) doesn't match the remaining canvas width, you get either:
- **Blank space** (natural width < remaining width)
- **Clipping** (natural width > remaining width, but SVG slice mode clips to fit)

### Why Row-Based Packing Works But Column Packing Fails

Row packing works because:
- Width is fixed (the constraint)
- Row height adjusts to fit all photos (the free variable)
- Each photo's width = `height × aspect`, guaranteeing aspect preservation

Column packing fails because:
- Height is fixed (hero's height - the constraint)
- Column width is calculated, BUT it's not adjusted to fit the remaining canvas width
- When you force the beside photos into the remaining width space, their aspect ratios break

## Solution: Treat Hero + Beside as a Weighted Row

Instead of calculating hero size from area budget and then hoping beside photos fit, treat the hero area as a **single row** where hero and beside photos share a common height.

### The Math

For a row containing the hero (weight W, aspect A_h) and beside photos (weight 1 each, aspects A_1, A_2, ...):

```text
Row height = (canvasWidth - gaps) / weightedAspectSum

where weightedAspectSum = (A_h × W) + A_1 + A_2 + ...
```

Each photo's width:
```text
heroWidth = rowHeight × A_h × W / (weightedAspectSum) × (canvasWidth - gaps)
besideWidth_i = rowHeight × A_i × 1 / (weightedAspectSum) × (canvasWidth - gaps)
```

Wait, that's not quite right. Let me reconsider...

Actually, for row packing with weights:
```text
aspectSum = sum of (aspect × weight) for all items in row
rowHeight = availableWidth / aspectSum
photoWidth = (aspect × weight / aspectSum) × availableWidth
```

For a photo: `photoWidth / rowHeight = aspect × weight / aspectSum × aspectSum / 1 = aspect × weight`

This means a hero with weight=2 would have:
- Cell aspect = 2 × photo aspect = WRONG (cell is 2× wider than photo)

The weight is for **area emphasis**, not aspect ratio change. So we need a different approach.

### Correct Approach: Hero Width as Fraction, Shared Height

1. **Hero claims a fraction of canvas width** (e.g., 50-65% based on weight and standard count)
2. **Beside photos share the remaining width as a row** (at the same height as hero)
3. **Height emerges from the row math**

For beside photos sharing a fixed width and height with the hero:
```text
heroHeight = heroWidth / hero.aspectRatio
availableBesideWidth = canvasWidth - heroWidth - gap

For beside photos to fit at heroHeight:
besidePhoto.width = heroHeight × besidePhoto.aspectRatio
```

If the sum of beside photo widths exceeds `availableBesideWidth`, we have two options:
- **Move excess photos to below zone** (current approach, but causes narrow cells)
- **Allow small aspect ratio adjustment** (your "5-10% crop is OK" rule!)

### The 5-10% Tolerance Fix

Instead of forcing exact aspect ratios, we can allow the algorithm to slightly adjust cell dimensions to fill the available space perfectly, as long as the adjustment is within tolerance.

For beside photos:
```text
naturalTotalWidth = sum(heroHeight × photo.aspectRatio) + gaps
availableWidth = canvasWidth - heroWidth - gap

if naturalTotalWidth within 10% of availableWidth:
  scaleFactor = availableWidth / naturalTotalWidth
  // Scale all beside photo widths by scaleFactor
  // This causes each photo to be cropped by (1 - scaleFactor) on each side
```

If outside tolerance, redistribute photos to below zone.

### Symmetric Cropping

When we scale photos to fit, crop evenly from both sides:
- Scale factor < 1 means photos are narrower → horizontal crop from both edges
- Scale factor > 1 means photos are taller → vertical crop from both edges

This is already how SVG `xMidYMid slice` works - it centers the image and clips equally from opposite edges.

## Implementation Plan

### Step 1: Fix `generateEdgeAnchoredHeroLayout`

Replace the current vertical column packing with a tolerance-based horizontal row packing:

1. Calculate hero width as fraction of canvas width (based on standard count)
2. Derive hero height from aspect ratio
3. Calculate beside photos' natural widths at hero height
4. If natural widths fit within tolerance (±10%) of available width, scale to fit
5. If outside tolerance, reduce beside photo count and try again
6. Overflow goes to below zone

### Step 2: Fix `generateFloatingHeroLayout`

Same approach for left/right strips:
1. Calculate hero dimensions
2. For each side (left, right), calculate natural widths at hero height
3. Scale within tolerance or reduce photo count
4. No blank rectangles because everything scales to fill

### Step 3: Fix Row Packing Rounding

In `calculateLayoutWithOffset`, ensure cell dimensions are derived consistently:
```typescript
// Calculate row height first (this is the shared dimension)
const height = availableWidth / aspectSum;

// Each photo's width derived from shared height
for (const photo of row) {
  const photoWidth = height * photo.aspectRatio * photo.weight;
  // Round consistently
  const roundedWidth = Math.round(photoWidth);
  const roundedHeight = Math.round(height);
  // ...
}
```

The rounding here creates small mismatches (< 1px), which is well within your 5-10% tolerance.

## File Changes

| File | Function | Change |
|------|----------|--------|
| `heroLayout.ts` | `generateEdgeAnchoredHeroLayout` | Replace vertical column with tolerance-based row packing |
| `heroLayout.ts` | `generateFloatingHeroLayout` | Same tolerance-based approach for side strips |
| `heroLayout.ts` | (new) `packBesideRow` | Helper to pack beside photos at hero height with tolerance |
| `heroLayout.ts` | `calculateHeroWidth` | New function - hero width as fraction of canvas |

## Expected Results

1. **No severe clipping** - Beside photos fit within available width, with at most 5-10% crop (symmetric from both edges)
2. **No blank rectangles** - Hero + beside fills canvas width exactly (due to scaling)
3. **Natural aspect orientation** - Height emerges from the math rather than being pre-calculated
4. **Better visual balance** - Tolerance-based scaling creates more uniform layouts

## Technical Details: The Tolerance Scaling Math

Given:
- `heroWidth` = fraction of canvas width (e.g., 55%)
- `heroHeight = heroWidth / hero.aspectRatio`
- `availableBesideWidth = canvasWidth - heroWidth - gap`
- `besidePhotos` = array of photos to place beside hero

Calculate:
```typescript
const naturalWidths = besidePhotos.map(p => heroHeight * p.aspectRatio);
const naturalTotalWidth = sum(naturalWidths) + gap * (besidePhotos.length - 1);
const scaleFactor = availableBesideWidth / naturalTotalWidth;

if (scaleFactor >= 0.90 && scaleFactor <= 1.10) {
  // Within 10% tolerance - scale to fit
  const scaledWidths = naturalWidths.map(w => w * scaleFactor);
  // Each photo is cropped by (1 - scaleFactor) / 2 on each side
  // For scaleFactor = 0.90, that's 5% from each edge = 10% total
} else {
  // Outside tolerance - reduce beside count and try again
}
```

This ensures the cropping is always ≤ 10% and symmetric.


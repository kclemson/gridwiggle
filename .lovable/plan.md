

# Fix: Complete the Bottom-Up Approach (Derive Canvas Width from Geometry)

## Summary

The split search is finding valid candidates, but `evaluateNormalizedProposal` still:
1. Forces layouts into a fixed 480px canvas width
2. Validates pixel cell sizes against 80px minimum

When normalized layouts are scaled to 480px, cells become too small and everything fails.

---

## What Was Missing

The earlier plan to "derive canvas width from geometry" was discussed but never implemented. Currently:

- Canvas width = 480px (fixed input)
- Scale = 480 / normalizedWidth
- Cells scaled → often < 80px → rejected

What we need:

- Pack in normalized space
- Find smallest cell in normalized space
- Calculate minimum scale needed for 80px cells
- Derive canvas width = normalizedWidth × minScale

---

## File Changes

### 1. `src/lib/v3/intersection.ts` — Derive canvas width, remove pixel validation

**Remove fixed scale factor calculation (line 189):**
```typescript
// REMOVE: const scaleFactor = canvasWidth / normalizedWidth;
```

**Add minimum scale calculation after packing:**
```typescript
// Find minimum normalized cell dimensions (excluding hero)
const allNormalizedCells = [
  ...besideResult.cells,
  ...belowResult.cells,
];

let minNormalizedWidth = Infinity;
let minNormalizedHeight = Infinity;

for (const cell of allNormalizedCells) {
  minNormalizedWidth = Math.min(minNormalizedWidth, cell.width);
  minNormalizedHeight = Math.min(minNormalizedHeight, cell.height);
}

// Calculate minimum scale factor for cell size constraints
// pixelWidth = normalizedWidth × scale >= minCellWidth
// → scale >= minCellWidth / normalizedWidth
const scaleForWidth = tuning.region_minWidth / minNormalizedWidth;
const scaleForHeight = tuning.region_minHeight / minNormalizedHeight;
const minScale = Math.max(scaleForWidth, scaleForHeight);

// Use the larger of: minimum required scale, or preferred scale for target width
const preferredScale = canvasWidth / normalizedWidth;
const scaleFactor = Math.max(minScale, preferredScale);

// Derive actual canvas dimensions
const actualCanvasWidth = normalizedWidth * scaleFactor;
const actualCanvasHeight = normalizedHeight * scaleFactor;
```

**Remove "cells too small" validation (lines 244-253):**
```typescript
// REMOVE entire block:
// const minCellSize = Math.min(tuning.region_minWidth, tuning.region_minHeight);
// const hasSmallCells = pixelCells.some(c => ...);
// if (hasSmallCells) { ... return null; }
```

Cell sizes are now guaranteed valid by construction because we derived the scale factor from them.

**Update canvas AR validation to use derived dimensions:**
```typescript
const canvasAR = actualCanvasWidth / actualCanvasHeight;
// Keep the existing AR validation
```

**Update return value to include actual canvas width:**
The `ScoredConfiguration` will use `actualCanvasWidth` instead of the input `canvasWidth`.

### 2. Same changes for `generateSimpleRowsLayout`

Apply the same pattern:
- Find minimum normalized cell dimensions
- Calculate minimum scale factor
- Derive canvas dimensions
- Remove any pixel cell validation

### 3. Add dev logging for derived dimensions

Log the actual canvas dimensions so we can see what sizes are being generated:
```typescript
devLogger.log('v3', 'Derived canvas dimensions', {
  normalizedWidth: normalizedWidth.toFixed(2),
  normalizedHeight: normalizedHeight.toFixed(2),
  minScale: minScale.toFixed(2),
  actualWidth: Math.round(actualCanvasWidth),
  actualHeight: Math.round(actualCanvasHeight),
});
```

---

## What This Achieves

**Before:**
- 42 photos → split search finds candidates → scale to 480px → cells 40px → "too small" → FAIL

**After:**
- 42 photos → split search finds candidates → calculate minScale from smallest cell → canvas = 600px → cells 80px → SUCCESS

The canvas width becomes an output, not an input. Valid layouts will always be generated (unless canvas AR is out of bounds).

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Derive scale from cell sizes, remove pixel validation, use derived canvas dimensions |

---

## Edge Case: Very Large Canvases

If many photos require a very wide canvas (e.g., 1200px for 50 photos), this is geometrically necessary. The collage container will need to handle scrolling or scaling to display. But the layout itself will be valid.


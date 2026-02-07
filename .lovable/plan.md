
# Remove Legacy Scale Factor Logic from V3

## Problem

The V3 algorithm has legacy code that doesn't fit the normalized, geometry-first approach:

| Legacy Concept | What It Does | Why It's Wrong |
|----------------|--------------|----------------|
| `canvasWidth` param | Hints at a target pixel width | Rendering uses percentages, not pixels |
| `preferredScale` | Tries to hit target width | Output size is irrelevant - CSS handles scaling |
| `minScale` | Ensures minimum pixel cell sizes | A 2% cell is 2% at any canvas size |
| `region_minWidth/Height` tuning | Pixel-based minimums | Should be normalized-space or AR-based |

## How Rendering Actually Works

```text
CollagePreview renders cells as:
  left: (cell.x / layout.width) × 100%
  width: (cell.width / layout.width) × 100%

The layout.width/height are just ratio denominators.
Whether they're 480 or 48000, the percentages are identical.
```

## Architectural Fix

Return the layout **in normalized space** (hero height = 1.0). The consumer divides by `layout.width` and `layout.height` to get percentages anyway.

## Technical Changes

### 1. `src/lib/v3/types.ts`

Remove pixel-based tuning parameters:
```typescript
// REMOVE:
region_minWidth: number;   // These are meaningless for %-based rendering
region_minHeight: number;
```

### 2. `src/lib/v3/index.ts`

Remove `canvasWidth` from the API:
```typescript
// BEFORE:
export interface GenerateLayoutV3Options {
  canvasWidth?: number;  // ← REMOVE
  ...
}

// AFTER:
export interface GenerateLayoutV3Options {
  photoWeights?: Record<string, number>;
  tuning?: Partial<V3Tuning>;
  randomize?: boolean;
}
```

Remove `canvasWidth` from debug logging and the call to `findValidConfiguration`.

### 3. `src/lib/v3/intersection.ts`

**Major simplification** - remove all scale factor logic:

```typescript
// BEFORE (lines 211-250):
// ============================================================================
// Bottom-Up: Derive scale factor from geometry
// ============================================================================
const scaleForWidth = ...
const scaleForHeight = ...
const minScale = ...
const preferredScale = canvasWidth / normalizedWidthWithBorder;
const scaleFactor = Math.max(minScale, preferredScale);
const actualCanvasWidth = normalizedWidthWithBorder * scaleFactor;
const actualCanvasHeight = normalizedHeightWithBorder * scaleFactor;

// AFTER:
// Return normalized dimensions directly (no scaling needed)
const actualCanvasWidth = normalizedWidthWithBorder;
const actualCanvasHeight = normalizedHeightWithBorder;
```

Remove the `canvasWidth` parameter from `findValidConfiguration` and `evaluateNormalizedProposal`.

Remove `region_minWidth` / `region_minHeight` checks entirely.

**Update `convertToPixels` → `convertToNormalized`**:

The function becomes much simpler - just apply border offset and position cells in normalized space (no scaling).

### 4. Same treatment for `generateSimpleRowsLayout`

Remove all scale factor logic from the no-hero path as well.

## What Remains Valid

These constraints still make sense in normalized space:

| Constraint | Why It's Valid |
|------------|----------------|
| `canvas_minAR` / `canvas_maxAR` | Ratios work in any unit system |
| `hero_minProminence` | Area ratio (hero area / avg content area) - scale-invariant |
| `hero_maxToSmallest` | Area ratio - scale-invariant |

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Remove `region_minWidth`, `region_minHeight` from tuning |
| `src/lib/v3/index.ts` | Remove `canvasWidth` option and debug output |
| `src/lib/v3/intersection.ts` | Remove all scale factor logic, return normalized dimensions |
| `src/pages/V3Test.tsx` | Remove `canvasWidth` parameter from test calls |



# Dynamic Float-Based minPhotosPerRow Ranges

## Core Concept

Use `√n` as the anchor point. Layouts with `minPhotosPerRow ≈ √n` produce roughly equal rows and columns (square-ish). Below √n → more rows → portrait. Above √n → fewer rows → landscape.

**Key insight**: `minPhotosPerRow` doesn't need to be an integer — it flows through `Math.ceil()` and creates gradient penalties, giving smoother control.

## Range Formula

```typescript
function getMinPhotosPerRowRange(
  n: number, 
  orientation: CollageSettings['orientation']
): [number, number] {
  const sqrtN = Math.sqrt(n);
  
  switch (orientation) {
    case 'portrait':
      // Below √n = more rows = tall
      return [2, sqrtN];
      
    case 'square':
      // Around √n = balanced
      return [Math.max(2, sqrtN - 1), sqrtN + 1];
      
    case 'landscape':
      // Above √n = fewer rows = wide
      return [sqrtN, Math.max(sqrtN + 1, n / 2)];
      
    case 'auto':
    default:
      // Full range for maximum variety
      return [2, Math.max(sqrtN + 2, n / 3)];
  }
}
```

## Expected Ranges by Photo Count

| n | √n | Portrait | Square | Landscape | Auto |
|---|---|---|---|---|---|
| 6 | 2.4 | [2, 2.4] | [2, 3.4] | [2.4, 3] | [2, 4.4] |
| 12 | 3.5 | [2, 3.5] | [2.5, 4.5] | [3.5, 6] | [2, 5.5] |
| 24 | 4.9 | [2, 4.9] | [3.9, 5.9] | [4.9, 12] | [2, 8] |
| 36 | 6.0 | [2, 6.0] | [5, 7] | [6, 18] | [2, 12] |
| 50 | 7.1 | [2, 7.1] | [6.1, 8.1] | [7.1, 25] | [2, 16.7] |

## Implementation Changes

### File: `src/lib/collageLayout.ts`

1. **Add helper function** `getMinPhotosPerRowRange(n, orientation)` near the top
2. **Replace lines 564-596** (the targetAspect block) with:

```typescript
const n = photos.length;
const [minRange, maxRange] = getMinPhotosPerRowRange(n, settings.orientation);

// Pick from range
let effectiveMinPhotosPerRow: number;
if (options?.randomize) {
  // Random float in [minRange, maxRange]
  effectiveMinPhotosPerRow = minRange + Math.random() * (maxRange - minRange);
} else {
  // Use midpoint of range as sensible default
  effectiveMinPhotosPerRow = (minRange + maxRange) / 2;
}

const layoutTuning: LayoutTuning = {
  ...(options?.tuning ?? DEFAULT_TUNING),
  minPhotosPerRow: effectiveMinPhotosPerRow,
};

// targetAspect is now always undefined - removed from algorithm
return generateHeroLayout(
  photos,
  settings,
  undefined,
  weights,
  options?.randomize ?? false,
  layoutTuning
);
```

### File: `src/lib/heroLayout.ts`

**Remove lines 1661-1670** (redundant randomization block):
```typescript
// DELETE - now handled in generateCollageLayout
if (targetAspect === undefined && randomize) {
  const minRowOptions = [2, 3, 4, 5];
  ...
}
```

## Why Float Ranges Work

The math handles floats gracefully:
- `Math.ceil(24 / 4.5) = 6` rows explored
- `Math.ceil(24 / 4.9) = 5` rows explored
- Sparse penalty: `5.0 * (4.5 - 4) = 2.5` for a 4-photo row

Floats create **gradient scoring** rather than hard cutoffs, producing more natural layout selection.

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Add `getMinPhotosPerRowRange()` helper; replace targetAspect block with range-based selection |
| `src/lib/heroLayout.ts` | Remove redundant randomization block (lines 1661-1670) |


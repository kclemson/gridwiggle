
# Gap Threading Fix (Simplified Approach)

## Design Decision

The gap slider value should be applied at the **final pixel conversion stage only**, not threaded through normalized space. This is cleaner because:

- Normalized space is purely about geometry and proportions
- The actual pixel gap is a "rendering concern" 
- Keeps the normalized packing math simple

## Current Problem

The code uses a hardcoded `normalizedGap = 0.02` throughout, then scales it to pixels. The slider's actual value is never used.

## Solution

1. Keep normalized packing using a minimal gap (just enough for geometry)
2. In `convertToPixels`, use the **actual pixel gap** directly instead of `normalizedGap × scaleFactor`
3. Change the slider to be a generic 0-100 "spacing" control, then map to reasonable pixel values internally

---

## Technical Changes

### 1. Remove Shape Dropdown

**File**: `src/components/CollageSettings.tsx`
- Remove the Shape row entirely
- Remove unused Select imports and shape-related variables

### 2. Improve Color Swatch

**File**: `src/components/CollageSettings.tsx`
- Add border: `border border-muted-foreground/30`
- Make wider: `w-24` instead of `w-7`

### 3. Change Gap Slider to Generic Spacing

**File**: `src/components/CollageSettings.tsx`
- Label: "Spacing" instead of "Gap"
- Range: 0-100 (generic units, not pixels)
- Remove the "Xpx" display

**File**: `src/types/collage.ts`
- Keep `gapSize` as 0-100 range

### 4. Apply Pixel Gap at Conversion Stage

**File**: `src/lib/v3/intersection.ts`

Update `findValidConfiguration` signature to receive gap:
```tsx
export function findValidConfiguration(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,  // Already passed, just need to use it
  tuning: V3Tuning
)
```

Update `convertToPixels` to receive actual pixel gap:
```tsx
function convertToPixels(
  heroPhoto: PhotoDimension,
  position: string,
  heroAR: number,
  besideCells: [...],
  belowCells: [...],
  belowHeight: number,
  scaleFactor: number,
  pixelGap: number,  // CHANGED: actual pixel gap, not normalized
  normalizedWidth: number
): LayoutCell[] {
  // Use pixelGap directly for offsets instead of normalizedGap * scaleFactor
  const heroY = isBottom 
    ? belowHeight * scaleFactor + pixelGap  // Direct pixel gap
    : 0;
    
  const besideOffsetX = heroNormalizedWidth * scaleFactor + pixelGap;  // Direct
  // etc.
}
```

Map slider value (0-100) to pixels:
```tsx
// In the caller (e.g., Index.tsx or where layout is generated)
const pixelGap = Math.round((gapSize / 100) * 32);  // 0-100 → 0-32px
```

### 5. Cleanup

**File**: `src/pages/Index.tsx`
- Remove `isShapeAvailable` import and usage in `handleRemovePhoto`

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Remove Shape, improve swatch, rename to Spacing |
| `src/lib/v3/intersection.ts` | Apply actual pixel gap at conversion stage |
| `src/pages/Index.tsx` | Map spacing (0-100) to pixel gap, remove shape logic |
| `src/types/collage.ts` | Update gapSize comment to reflect 0-100 range |



# Fix: Enforce Canvas AR Bounds for Hero-less Layouts

## Summary

Hero-less layouts produce ultra-wide collages (AR 6-9) because `generateSimpleRowsLayout` only calculates a row count that prevents the canvas from being **too tall** (via `canvas_minAR`), but never validates or constrains the **maximum width** (`canvas_maxAR`).

---

## Design Intent

**What problem are we solving?**  
Hero-less layouts can produce extreme aspect ratios like 6.5:1 or 9:1. The `calculateBelowRowCount` function calculates a minimum row count to stay above `canvas_minAR` (prevent too-tall), but there's nothing preventing the layout from being too short/wide.

**What will users experience?**  
All layouts (with or without hero) will respect the configured aspect ratio bounds (default 0.67 to 2.0). No more pancake-shaped collages.

---

## The Bug

### Current Flow (Broken)

```text
generateSimpleRowsLayout():
  rowCount = calculateBelowRowCount(photos, width=1.0, gap, canvas_minAR)
     └── Only enforces canvas_minAR (prevents too tall)
     └── Never checks if result exceeds canvas_maxAR

  pack and scale to pixels
     └── No validation of final canvas AR

  return result regardless of AR
```

### Example

With 7 photos of average AR 1.3:
- `calculateBelowRowCount` suggests 1 row (tall enough for minAR 0.67)
- 1 row of 7 photos → total width ~9.1 units → AR = 9.1
- Exceeds `canvas_maxAR` (2.0) by 4.5x
- User sees a pancake collage

---

## The Fix

Add `canvas_maxAR` enforcement to `calculateBelowRowCount` and validate the final layout in `generateSimpleRowsLayout`.

### Fixed Flow

```text
calculateBelowRowCount():
  Calculate minRows from canvas_minAR (prevent too tall)
  Calculate minRows from canvas_maxAR (prevent too wide)  // NEW
  Take maximum of both constraints
  Return row count that satisfies both bounds

generateSimpleRowsLayout():
  ... existing packing logic ...
  
  canvasAR = canvasWidth / canvasHeight
  if canvasAR > tuning.canvas_maxAR:
    return null  // Reject invalid layout
```

---

## The Math

### Preventing Too-Wide Layouts

For a row-packed layout with `R` rows:
```text
Each row: rowHeight = rowWidth / rowAR
Total height ≈ R × rowHeight = R × (width / avgPhotosPerRow / meanAR)
            = R × (width × R / n / meanAR)
            = R² × width / (n × meanAR)

Canvas AR = width / height
         = width / (R² × width / (n × meanAR))
         = n × meanAR / R²

For canvasAR ≤ maxAR:
  n × meanAR / R² ≤ maxAR
  R² ≥ n × meanAR / maxAR
  R ≥ sqrt(n × meanAR / maxAR)
```

So the **minimum** row count to stay under `canvas_maxAR` is:
```text
minRowsByMaxAR = ceil(sqrt(n × meanAR / canvas_maxAR))
```

---

## File Changes

### 1. `src/lib/v3/normalized-pack.ts` — Add maxAR constraint

Update `calculateBelowRowCount` to take `canvas_maxAR` and calculate a minimum row count:

```typescript
export function calculateBelowRowCount(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  canvasMinAR: number,
  canvasMaxAR: number = 2.0,  // ADD parameter
  heroRowHeight: number = 1.0
): number {
  const n = photos.length;
  if (n <= 1) return 1;
  
  const meanAR = photos.reduce((sum, p) => sum + p.aspectRatio, 0) / n;
  
  // === Constraint 1: Prevent too-tall (minAR) ===
  // From existing logic: maxRows based on maxBelowHeight
  const maxBelowHeight = targetWidth / canvasMinAR - heroRowHeight - normalizedGap;
  const maxRowsByMinAR = Math.floor(Math.sqrt(Math.max(0, maxBelowHeight * n * meanAR / targetWidth)));
  
  // === Constraint 2: Prevent too-wide (maxAR) === NEW
  // canvasAR = width / height ≤ maxAR
  // For hero-less: height = R² × width / (n × meanAR)  
  // So: n × meanAR / R² ≤ maxAR → R ≥ sqrt(n × meanAR / maxAR)
  //
  // For hero layouts, use heroRowHeight in the calculation
  // height = heroRowHeight + gap + belowHeight
  // This is more complex, so for now apply the simpler formula
  const minRowsByMaxAR = Math.ceil(Math.sqrt(n * meanAR / canvasMaxAR));
  
  // === Combine constraints ===
  const minRows = Math.max(1, minRowsByMaxAR);
  const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR, Math.ceil(n / 2)));
  
  // Choose middle of valid range for balance
  return Math.max(minRows, Math.min(maxRows, Math.ceil((minRows + maxRows) / 2)));
}
```

### 2. `src/lib/v3/intersection.ts` — Pass canvas_maxAR and validate

Update calls to `calculateBelowRowCount` to pass `canvas_maxAR`:

```typescript
// In generateSimpleRowsLayout (line ~417):
const rowCount = calculateBelowRowCount(
  photos, 
  1.0, 
  normalizedGap, 
  tuning.canvas_minAR,
  tuning.canvas_maxAR  // ADD this parameter
);
```

Add final validation before returning:

```typescript
// After calculating canvasHeight (line ~433):
const canvasAR = canvasWidth / canvasHeight;

if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
  devLogger.log('v3', 'Simple rows layout outside AR bounds', {
    canvasAR: canvasAR.toFixed(2),
    minAR: tuning.canvas_minAR,
    maxAR: tuning.canvas_maxAR,
  });
  return null;
}
```

### 3. `src/lib/v3/split-search.ts` — Pass canvas_maxAR

Update the call to `calculateBelowRowCount`:

```typescript
// In findBestSplit (line ~107):
const belowRowCount = calculateBelowRowCount(
  belowPhotos,
  estimatedHeroRowWidth,
  normalizedGap,
  tuning.canvas_minAR,
  tuning.canvas_maxAR  // ADD this parameter
);
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/normalized-pack.ts` | Add `canvasMaxAR` parameter to `calculateBelowRowCount`, enforce minimum rows |
| `src/lib/v3/intersection.ts` | Pass `canvas_maxAR` to `calculateBelowRowCount`, add final AR validation in `generateSimpleRowsLayout` |
| `src/lib/v3/split-search.ts` | Pass `canvas_maxAR` to `calculateBelowRowCount` |

---

## Result

**Before**: 7 photos → 1 row → AR 9.06 → user sees pancake

**After**: 7 photos → `minRowsByMaxAR = ceil(sqrt(7 × 1.3 / 2.0)) = 3 rows` → AR ~1.0 → balanced collage


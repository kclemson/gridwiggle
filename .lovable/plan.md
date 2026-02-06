
# Fix Canvas AR Enforcement for Hero-less Layouts

## Summary

Add canvas AR constraint enforcement to the `generateSimpleRowsLayout` function, which currently bypasses all AR checks.

---

## Design Intent

**Problem**: Canvas AR enforcement was added to `evaluateProposal` (hero layouts), but layouts with no hero photo go through a separate path (`generateSimpleRowsLayout`) that has no AR limits.

**Solution**: Apply the same `maxHeight = canvasWidth / canvas_minAR` constraint to hero-less layouts.

**User Outcome**: All layouts—hero or not—will respect the 0.67 AR floor. For 480px width, max height will be ~716px instead of 2396px.

---

## The Math

```text
maxCanvasHeight = canvasWidth / canvas_minAR
                = 480 / 0.67
                ≈ 716px
```

The packing algorithm will pack rows until either:
- All photos are placed, OR
- Adding another row would exceed `maxHeight`

If photos can't fit within the height budget, the constraint-aware packing will return fewer rows (forcing more photos per row, making cells smaller).

---

## Changes

### `src/lib/v3/intersection.ts` — generateSimpleRowsLayout

**Before (lines 342-356):**
```typescript
// Create a region spanning the full canvas width
const region: RegionSpec = {
  x: 0,
  y: 0,
  width: canvasWidth,
  height: Infinity, // Will be determined by packing
};

// Pack all photos into rows
const result = packPhotosIntoRegion(
  photos,
  region,
  gap,
  tuning
);
```

**After:**
```typescript
// Calculate max allowed height from canvas AR constraint
const maxCanvasHeight = canvasWidth / tuning.canvas_minAR;

// Create a region spanning the full canvas width
const region: RegionSpec = {
  x: 0,
  y: 0,
  width: canvasWidth,
  height: Infinity, // Will be determined by packing
};

// Pack all photos into rows with height constraint
const result = packPhotosIntoRegion(
  photos,
  region,
  gap,
  tuning,
  { maxHeight: maxCanvasHeight }  // Apply canvas AR constraint
);

devLogger.log('v3', 'Simple rows layout', {
  photoCount: photos.length,
  maxCanvasHeight: Math.round(maxCanvasHeight),
  actualHeight: Math.round(result.actualHeight),
  canvasAR: (canvasWidth / result.actualHeight).toFixed(2),
});
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Add `maxHeight` constraint to `generateSimpleRowsLayout` |

---

## Result

**Before**: 22 photos → 480×2396px (0.20 AR) — no constraint on hero-less layouts

**After**: 22 photos → 480×~716px max (0.67 AR) — canvas AR enforced on all layouts


# ✅ COMPLETED: Remove Legacy Scale Factor Logic from V3

## Summary

Removed pixel-based legacy code that didn't fit the normalized, geometry-first approach:

| Removed | Why |
|---------|-----|
| `canvasWidth` param | Rendering uses percentages, not pixels |
| `preferredScale` | Output size is irrelevant - CSS handles scaling |
| `minScale` | A 2% cell is 2% at any canvas size |
| `region_minWidth/Height` tuning | Meaningless for %-based rendering |

## Files Changed

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Removed `region_minWidth`, `region_minHeight` from V3Tuning (8→6 params) |
| `src/lib/v3/index.ts` | Removed `canvasWidth` option and pixel-based logging |
| `src/lib/v3/intersection.ts` | Removed all scale factor logic, returns normalized dimensions |
| `src/lib/v3/row-pack.ts` | Removed pixel-based row count constraints |
| `src/lib/v3/entities/canvas.ts` | Removed pixel-based viability checks |
| `src/lib/v3/entities/content-pool.ts` | Simplified region evaluation for normalized space |
| `src/pages/V3Test.tsx` | Removed `canvasWidth` parameter from test calls |

## How It Works Now

The V3 algorithm now returns layouts in **pure normalized space** where hero height = 1.0:

```text
CollagePreview renders cells as:
  left: (cell.x / layout.width) × 100%
  width: (cell.width / layout.width) × 100%

The layout.width/height are now small normalized values (e.g., 1.5 × 1.2).
CSS converts these to percentages for responsive rendering at any container size.
```

## Valid Constraints (Scale-Invariant)

| Constraint | Why Valid |
|------------|-----------|
| `canvas_minAR` / `canvas_maxAR` | Ratios work in any unit system |
| `hero_minProminence` | Area ratio (hero / content) - scale-invariant |
| `hero_maxToSmallest` | Area ratio - scale-invariant |

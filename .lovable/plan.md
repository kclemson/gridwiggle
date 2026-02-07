

# Fix Tiny Collage Output After Scale Factor Removal

## Root Cause

The scale factor removal left a critical gap: we're returning **normalized space** dimensions (like 2.1 × 3.2) but the `CollagePreview` uses `layout.width` as a **pixel-based `maxWidth`**.

```typescript
// src/lib/v3/index.ts - The Problem
return {
  width: Math.round(config.canvasWidth),   // 2.1 → 2 (pixels!)
  height: Math.round(config.canvasHeight), // 3.2 → 3 (pixels!)
  cells,
};
```

```typescript
// CollagePreview.tsx - How it's used
const effectiveMaxWidth = Math.min(layout.width, heightConstrainedWidth);
// When layout.width = 2, the preview is 2 pixels wide!
```

## Design Decision

The normalized model is correct for the layout algorithm, but the consumer expects meaningful pixel values for `maxWidth` calculations. Two options:

1. **Multiply by a base unit** - Return e.g. `width * 1000` to get usable pixel values
2. **Change CollagePreview to ignore layout dimensions** - Use pure percentage-based sizing

**Option 1 is simpler** and doesn't require changing the preview component. We pick a "virtual canvas" base unit (e.g., 1000) and scale the normalized output to it.

## Technical Changes

### File: `src/lib/v3/index.ts`

Add a virtual canvas base unit and scale the output:

```typescript
// Virtual canvas base unit - normalized dimensions are scaled to this
// for meaningful pixel values in preview/export calculations
const VIRTUAL_CANVAS_BASE = 1000;

// In generateCollageLayoutV3:
return {
  width: Math.round(config.canvasWidth * VIRTUAL_CANVAS_BASE),
  height: Math.round(config.canvasHeight * VIRTUAL_CANVAS_BASE),
  cells: config.cells.map(cell => ({
    photoId: cell.photoId,
    x: cell.x * VIRTUAL_CANVAS_BASE,
    y: cell.y * VIRTUAL_CANVAS_BASE,
    width: cell.width * VIRTUAL_CANVAS_BASE,
    height: cell.height * VIRTUAL_CANVAS_BASE,
  })),
};
```

This preserves the percentage-based rendering (since everything scales proportionally) while giving `CollagePreview` meaningful values for `maxWidth`.

## Why 1000?

- Large enough for sub-pixel precision in cell positioning
- Small enough to not overflow when used in calculations
- Produces human-readable values (e.g., 2100 × 3200 instead of 2.1 × 3.2)
- The actual preview width is still controlled by CSS - this just provides a sensible upper bound

## Summary

| File | Change |
|------|--------|
| `src/lib/v3/index.ts` | Multiply all dimensions/coordinates by 1000 before returning |

This is a 10-line change that fixes both the tiny preview and restores sane debugging values.


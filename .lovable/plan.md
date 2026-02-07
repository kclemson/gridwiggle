
# Fix Edge Gap Issues: Algorithm-First Border Padding

## Understanding the Two Issues

### Issue 1: 1px gap on right edge when slider = 0
When the slider is at minimum, `normalizedGap = 0`, so gaps should be zero everywhere. The slim 1px line is a **rounding artifact**: when converting normalized coordinates to pixel percentages in CollagePreview, floating-point precision combined with `Math.round()` can cause the sum of cell widths to be 1px less than the container width.

### Issue 2: No border around canvas edges
The slider controls gaps BETWEEN photos (via the normalized packing algorithm), but there's no padding at the canvas EDGES. The previous "presentation layer fix" tried adding CSS padding, but passed the wrong value - it used the raw slider (0-100) instead of actual pixel spacing.

---

## The Correct Architectural Solution

**Include border padding in the normalized space algorithm itself.**

This means:
- Photos start at position `(normalizedGap, normalizedGap)` instead of `(0, 0)`
- Canvas dimensions grow by `2 * normalizedGap` in both directions
- The layout coordinates already include borders - no presentation layer adjustment needed
- Export will automatically include the correct border

This is cleaner than a presentation-layer fix because:
1. Single source of truth (the algorithm)
2. Export uses the same layout, so borders will be correct in exported images
3. No disconnect between what the algorithm produces and what's displayed

---

## Technical Changes

### File 1: `src/lib/v3/intersection.ts`

**In `generateSimpleRowsLayout` (~lines 523-529):**

Offset all cell positions by the normalized gap (border padding), and expand canvas dimensions:

```typescript
// Convert cells to pixels - offset by gap for border padding
const cells: LayoutCell[] = normalizedResult.cells.map(cell => ({
  photoId: cell.photoId,
  x: (cell.x + normalizedGap) * scaleFactor,  // Add left border
  y: (cell.y + normalizedGap) * scaleFactor,  // Add top border
  width: cell.width * scaleFactor,
  height: cell.height * scaleFactor,
}));

// Canvas includes border on all sides
const actualCanvasWidth = (1.0 + 2 * normalizedGap) * scaleFactor;
const actualCanvasHeight = (normalizedResult.height + 2 * normalizedGap) * scaleFactor;
```

**In `convertToPixels` (for hero layouts):**

Apply the same offset to all cells - hero, BESIDE, and BELOW all shift by `normalizedGap * scaleFactor` in both X and Y.

**In `evaluateNormalizedProposal` canvas dimension calculation:**

```typescript
// Include border in normalized canvas dimensions
const normalizedWidthWithBorder = normalizedWidth + 2 * normalizedGap;
const normalizedHeightWithBorder = normalizedHeight + 2 * normalizedGap;

// Scale to pixels
const actualCanvasWidth = normalizedWidthWithBorder * scaleFactor;
const actualCanvasHeight = normalizedHeightWithBorder * scaleFactor;
```

### File 2: `src/components/CollagePreview.tsx`

**Remove the CSS padding (~line 243):**

Since the layout now includes border padding in its coordinates, remove the `padding: gap` style - it's no longer needed.

```typescript
// Before:
style={{
  // ...
  padding: gap,
}}

// After - no padding, layout handles it:
style={{
  // ...
  // padding removed - layout includes border
}}
```

**Also update the dimension calculations (~lines 221-226):**

Remove the `+ (2 * gap)` from paddedWidth/paddedHeight since the layout dimensions now already include borders.

```typescript
// Before:
const paddedWidth = layout.width + (2 * gap);
const paddedHeight = layout.height + (2 * gap);

// After - layout already includes padding:
const paddedWidth = layout.width;
const paddedHeight = layout.height;
// (or just remove these variables and use layout.width/height directly)
```

---

## Edge Case: Slider at 0

When `normalizedGap = 0`:
- All cell positions stay at their original coordinates (no offset)
- Canvas dimensions equal the photo area exactly
- No visible border (photos touch canvas edge)
- This is the expected behavior

---

## Summary of Changes

| Location | Change |
|----------|--------|
| `intersection.ts` `generateSimpleRowsLayout` | Add `+ normalizedGap` to cell x/y positions |
| `intersection.ts` `generateSimpleRowsLayout` | Add `+ 2 * normalizedGap` to canvas width/height |
| `intersection.ts` `convertToPixels` | Add border offset to all cell positions |
| `intersection.ts` `evaluateNormalizedProposal` | Include border in canvas dimensions |
| `CollagePreview.tsx` | Remove CSS `padding: gap` |
| `CollagePreview.tsx` | Remove manual padding from dimension calculations |

## Result

- Slider at 0: Photos touch each other AND the canvas edges (no gaps anywhere)
- Slider at 50: Uniform gaps between photos AND around canvas border
- Export matches preview exactly (same layout coordinates)
- Single source of truth in the algorithm

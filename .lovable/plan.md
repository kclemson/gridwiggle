

# Fix UI-Layer Shuffle Lag (In-Session, Thumbnails Already Loaded)

Since you never closed the tab, 480px thumbnails are already in memory. The lag comes from three things happening on every shuffle:

## Root Causes

### 1. `transition-all` animates layout geometry changes (BIGGEST impact)
Line 53 of `CollagePreview.tsx` has `transition-all` on every cell. When you shuffle, every cell gets new `left`, `top`, `width`, `height` values. The browser tries to smoothly animate all four geometric properties across all 11 cells simultaneously -- that is 44 CSS transitions firing at once, each triggering layout recalculation every frame. This is the primary source of visible lag.

**Fix**: Replace `transition-all` with `transition-opacity`. The only transition needed is the drag-dimming effect. Position/size changes from a shuffle should snap instantly.

### 2. Synchronous localStorage serialization on every shuffle
`setLayout()` calls `debouncedSaveMetadata()` which runs `JSON.stringify()` on the entire collage state (11 photos' metadata + full layout with all cell coordinates). While debounced at 300ms, it still runs synchronously on the main thread and can block during the critical post-shuffle render window.

**Fix**: No code change needed here -- the 300ms debounce already handles this adequately. The `transition-all` fix alone should resolve the perceived lag.

### 3. Multiple setState calls trigger extra React renders
After the worker returns, `useCollageGeneration` calls `setDebugLogs`, `setLastDurationMs`, `setSoftRejection`, `setLayoutMeta`, and `setLayout` as five separate state updates. React 18 batches these in most cases, but the async worker callback may not always batch cleanly.

**Fix**: Combine `debugLogs`, `lastDurationMs`, `softRejection`, and `layoutMeta` into a single state object to guarantee a single update.

### 4. Missing `decoding="async"` on images
Without this attribute, the browser may synchronously decode image data during render, blocking the main thread.

**Fix**: Add `decoding="async"` to all `<img>` elements in `CroppedImage.tsx`.

## Changes

### File 1: `src/components/CollagePreview.tsx`
- Line 53: Change `transition-all` to `transition-opacity`
- One-line change, largest impact

### File 2: `src/hooks/useCollageGeneration.ts`
- Combine four separate `useState` hooks (`debugLogs`, `lastDurationMs`, `softRejection`, `layoutMeta`) into one `genMeta` state object
- Update the worker result handler to set them in a single `setGenMeta()` call
- Update return values to destructure from the combined object

### File 3: `src/components/common/CroppedImage.tsx`
- Add `decoding="async"` to all four `<img>` elements (three fallback paths + the cropped render)

## Expected Impact

| Fix | Estimated improvement |
|-----|----------------------|
| `transition-all` to `transition-opacity` | Largest: eliminates 44 concurrent CSS transitions per shuffle |
| Batched state updates | Small-medium: reduces render passes from up to 5 to 2 |
| `decoding="async"` | Small: unblocks main thread during image decode |

## Files Modified
- `src/components/CollagePreview.tsx`
- `src/hooks/useCollageGeneration.ts`
- `src/components/common/CroppedImage.tsx`


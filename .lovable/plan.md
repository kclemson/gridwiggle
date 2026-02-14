

# Fix Slow Fade-In on Collage Images

## Problem
The previous fix changed `transition-all` to `transition-opacity` on collage cells. But `transition-opacity` still applies a CSS transition to opacity changes, causing images to slowly fade in instead of appearing instantly.

## Fix
In `src/components/CollagePreview.tsx`, remove the `transition-opacity` class entirely. The drag feedback (opacity dimming) doesn't need a smooth transition -- it can snap too, and the visual effect is fine.

### File: `src/components/CollagePreview.tsx`
- Line 53: Remove `transition-opacity` from the cell's className
- The `opacity-50` and `scale-95` classes for drag state will still apply, they just won't animate (which is fine for drag feedback -- instant visual response is actually better)

## Technical Detail
- `transition-opacity` tells the browser to animate any opacity change over the default 150ms duration
- When cells re-render with new images or positions, any opacity recalculation triggers this slow fade
- Removing it means all visual changes snap instantly, which is the correct behavior for layout shuffles

## Files Modified
- `src/components/CollagePreview.tsx` (one line change)

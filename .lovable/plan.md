

# Simplified Sample Gallery: Single Row with Scale Transform

## What Users Will See
Four thumbnails in a single horizontal row, all the same base size. Every 3 seconds, one thumbnail smoothly scales up (e.g., `scale(1.15)`), holds briefly, then scales back down as the next one scales up. Tapping any thumbnail opens the lightbox.

## Layout
- Single row: `grid grid-cols-4 gap-1.5` inside a `max-w-md` container
- All cells are equal size, square aspect ratio via `aspect-square`
- No rounded corners
- `object-cover` on all images

## Animation
- `featuredIndex` cycles 0-3 every 3 seconds (existing `setInterval` logic, already pauses when lightbox is open)
- The featured thumbnail gets `scale-110` (or similar), others stay at `scale-100`
- Each thumbnail has `transition-transform duration-500 ease-in-out` so the scale change animates smoothly
- This is purely a transform -- no layout shift, no grid reflow, no reordering

## Technical Details

### File: `src/components/SampleGallery.tsx`
- Replace the entire grid container (the `div` with `grid grid-cols-3 grid-rows-2`) with a `grid grid-cols-4 gap-1.5` container
- Remove `order`, `col-span-*`, `row-span-*`, and `transition-[grid-area]` classes
- Each button gets a fixed style: `aspect-square overflow-hidden`
- Conditionally apply `scale-110` (featured) vs `scale-100` (others) plus `transition-transform duration-500 ease-in-out`
- Add `z-10` to the featured thumbnail so it renders above neighbors when scaled
- No other logic changes -- `featuredIndex` state, `setInterval`, lightbox all stay the same

### No other files need changes


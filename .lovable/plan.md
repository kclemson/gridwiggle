

# Fix PhotoStrip Button Overflow on Mobile

## Problem
On mobile screens (~375px wide), four buttons with text labels ("Adjust Crops", "Add Photos", "Generate", "Clear All") overflow the single row, cutting off icons and text.

## Solution
On mobile, switch to a two-row layout and shorten labels so everything fits comfortably.

## Changes to `src/components/PhotoStrip.tsx`

**Wrap the button row for mobile**: Change the container from a single `flex` row to `flex flex-wrap justify-center` so buttons can flow to a second line on narrow screens.

**Shorten labels on mobile**: Use responsive text -- on small screens, use abbreviated labels:
- "Adjust Crops" becomes "Crops" (the Crop icon already communicates the action)
- "Add Photos" becomes "Add"
- "Clear All" becomes "Clear"
- "Generate" stays as-is (short enough)

Implementation approach:
- Use `<span className="hidden sm:inline">` for the longer words and `<span className="sm:hidden">` for shortened versions
- This keeps full labels on desktop and short labels on mobile with zero JS overhead

**Result on mobile (~375px)**: All buttons fit on one row with shortened labels: `[Crops] [Add] [Generate] [Clear]` -- each with its icon, no overflow.

If even shortened labels overflow (e.g., with Generate present), the `flex-wrap` ensures graceful wrapping to two rows rather than clipping.


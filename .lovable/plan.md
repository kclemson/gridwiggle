
# Fix Thumbnail Size Constraints

## Problem
The `max-w-md` container (448px) split into 4 grid columns with `gap-6` leaves each cell only ~96px wide. Without `aspect-square` or an explicit height, the images render at whatever tiny size CSS computes from the remaining space.

## Solution
Two changes in `src/components/SampleGallery.tsx`:

1. **Use `flex` instead of `grid`** -- Switch to `flex items-center justify-center gap-6` so each thumbnail sizes itself naturally based on its image content rather than being constrained to a grid fraction.

2. **Set explicit thumbnail dimensions** -- Give each button a fixed height (e.g., `h-20`) and auto width, with `object-contain` on the `<img>` instead of `object-cover`. This lets each sample show its natural aspect ratio (landscape vs portrait) at a readable size.

3. **Remove `max-w-md`** -- Widen the outer container to `max-w-lg` so the 4 thumbnails + gaps have enough room.

## Technical Details

### File: `src/components/SampleGallery.tsx`

- Line 45: Change outer container from `max-w-md` to `max-w-lg`
- Line 46: Replace `grid grid-cols-4 gap-6` with `flex items-center justify-center gap-6`
- Lines 53-57: Button classes become `overflow-hidden relative h-20 transition-transform duration-500 ease-in-out` plus the scale conditional
- Line 62: Change img from `w-full h-full object-cover` to `h-full w-auto object-contain` so natural aspect ratios are preserved

### No other files change.

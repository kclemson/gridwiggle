

# Sample Gallery Tweaks

## Changes (all in `src/components/SampleGallery.tsx`)

1. **Remove "See what's possible" text** -- Delete the `<p>` element with that label and its bottom margin.

2. **Increase gap 4x** -- Change `gap-1.5` to `gap-6` on the grid container, giving the scale animation room to breathe.

3. **Show natural aspect ratios** -- Remove `aspect-square` from thumbnail buttons so each collage displays at its native proportions (landscape vs portrait). The images already use `object-cover`, so they'll fill their natural bounds.

## No other files change.


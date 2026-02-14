

# Bigger Sample Thumbnails on All Screen Sizes

## Changes in `src/components/SampleGallery.tsx`

1. **Remove max-width constraint**: Change `max-w-lg` to just `w-full` so thumbnails aren't artificially squeezed on any screen size.

2. **Increase thumbnail height universally**: Change `h-40` to `h-56` so all thumbnails are visibly larger on both mobile and desktop.

## Technical Details

### File: `src/components/SampleGallery.tsx`

- Outer container (line ~55): Change `max-w-lg mx-auto` to `w-full` (keep `mt-6 px-4`)
- Button height (line ~59): Change `h-40` to `h-56`

No other files change.


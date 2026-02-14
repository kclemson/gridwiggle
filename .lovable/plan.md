
# Keyboard Navigation and Trim to 3 Samples

## Changes (all in `src/components/SampleGallery.tsx`)

### 1. Remove sample-collage-1 (the square-ish one)
Drop the `sample1` import and update the `samples` array to only contain `[sample2, sample3, sample4]`, leaving one each of square, landscape, and portrait. Update the `featuredIndex` modulo arithmetic accordingly (now `% 3`).

### 2. Add left/right arrow key navigation in the lightbox
Add a `useEffect` that listens for `keydown` events when the lightbox is open (`selectedIndex !== null`). On `ArrowLeft`, call `navigate(-1)`; on `ArrowRight`, call `navigate(1)`. Clean up the listener on close/unmount.

## Technical Details

### File: `src/components/SampleGallery.tsx`

- Lines 12-17: Remove `sample1` import, change array to `[sample2, sample3, sample4]`
- After the existing `navigate` callback (~line 40): Add a `useEffect` with a `keydown` handler for `ArrowLeft`/`ArrowRight` that calls `navigate`, gated on `selectedIndex !== null`

No other files change.

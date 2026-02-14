

# Remove Padding Constraints from Sample Gallery

## Problem
The sample thumbnails are squeezed because they're nested inside multiple layers of padding:
- Index.tsx wraps everything in `max-w-lg mx-auto` (max 512px)
- PhotoUploader adds `p-8` padding
- SampleGallery adds its own `px-4`

The thumbnails end up with very little room despite the screen being much wider.

## Solution
Move the SampleGallery outside the `max-w-lg` container so it can use the full screen width, and reduce its horizontal padding.

### File: `src/components/SampleGallery.tsx`
- Change `px-4` to `px-2` on the outer div to minimize side padding

### File: `src/components/PhotoUploader.tsx`
- Remove `<SampleGallery />` from inside the uploader (it's trapped in the padded container)

### File: `src/pages/Index.tsx`
- Add `<SampleGallery />` below the `max-w-lg` container div but still inside the outer `min-h-screen` div, so it renders at full width when no photos are uploaded
- Import SampleGallery
- Conditionally render it only when `state.photos.length === 0`

This way the upload prompt stays centered in the narrow column, but the sample thumbnails stretch across the full viewport.

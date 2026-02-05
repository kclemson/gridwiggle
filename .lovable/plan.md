
# Update Upload Button Tagline

## Change

Replace the "2-8 photos" hint with the app's value proposition tagline from the OpenGraph metadata.

**File:** `src/components/PhotoUploader.tsx`

| Line | Before | After |
|------|--------|-------|
| 97 | `Select 2-8 photos for best results` | `Turn any collection of photos into a perfectly arranged collage` |

The tagline from `index.html` is: *"Turn any collection of photos into a perfectly arranged collage with one drop."*

I'll use a slightly shortened version that removes "with one drop" since the user is already on the upload screen about to do the "one drop" action - the context is obvious.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/PhotoUploader.tsx` | Update line 97 text |

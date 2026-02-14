

# Cap Sample Thumbnail Height on Desktop

## Problem
The `h-56` height works great on mobile but makes thumbnails overly large on wider desktop screens.

## Solution
Use responsive height: `h-56 sm:h-44` -- keep the nice big mobile size (224px) but cap at 176px on `sm+` screens where the thumbnails spread wider anyway.

## Technical Details

### File: `src/components/SampleGallery.tsx`
- Change the button's `h-56` class to `h-56 sm:h-44`


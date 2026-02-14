

# Fix Dashed Border Clipping Subtitle Text

## Problem
The dashed upload button uses `aspect-video` which constrains its height. The bottom text ("Turn any collection of photos into a perfectly arranged collage") gets clipped by the dashed border, especially on hover.

## Solution
Add more bottom padding inside the button to give the subtitle text breathing room within the dashed border.

## Technical Details

### File: `src/components/PhotoUploader.tsx`
- Change the inner `div` padding from `p-8` to `px-8 pt-8 pb-10` to add extra space at the bottom, ensuring the subtitle text doesn't clip against the dashed border.




# Fix Generate Button Wrapping to Second Row on Desktop

## Problem
With `flex-wrap`, the Generate button causes all four buttons plus Generate to wrap "Clear All" to a second row even on desktop, which looks awkward.

## Solution
Move the Generate button to its own row below the utility buttons. The three utility buttons (Adjust Crops, Add Photos, Clear All) stay on one row and always fit. Generate gets visual prominence on its own line.

## Changes to `src/components/PhotoStrip.tsx`

**Split into two rows**:
- Row 1: Adjust Crops, Add Photos, Clear All -- always on one line, no wrapping needed
- Row 2 (conditional): Generate button, only when `showGenerateButton` is true, centered on its own line

Remove `flex-wrap` from the utility row since it's no longer needed. Move the Generate button block outside that row into a sibling div.


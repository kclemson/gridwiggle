

# Remove Rounded Corners from Photo Thumbnails

## Change

The photo thumbnail `button` inside each card currently has `rounded` in its className. Remove it so the photo has square corners, matching the crop overlay which we already fixed to have square corners.

## Technical Details

**File:** `src/components/ThumbnailNavigator.tsx`

The `button` element wrapping each photo (around line 131) has className containing `rounded`. Remove that class. Also remove `rounded` from the Skeleton fallback (around line 178).

The outer card wrapper keeps its `rounded-lg` since that's the card border, not the photo itself.

| Location | Change |
|----------|--------|
| ~line 135 | Remove `rounded` from the photo button className |
| ~line 178 | Remove `rounded` from the Skeleton className |


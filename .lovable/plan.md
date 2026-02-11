

# Center Thumbnails Horizontally in Gallery Cards

## Problem

Photos sit in the top-left corner of their cards because the thumbnail `<button>` has a fixed pixel width while the card can grow wider via `flex: 1 1 ...` with the 1.8x max-width cap. Nothing centers the button within the extra space.

## Fix

**File:** `src/components/ThumbnailNavigator.tsx`

Add `items-center` to the card's outer `<div>` (the one with `rounded-lg border...`) so the fixed-width button is horizontally centered within the flexible card width.

Current (line ~123):
```
className="rounded-lg border border-border/70 bg-surface-elevated/60 overflow-hidden"
```

New:
```
className="rounded-lg border border-border/70 bg-surface-elevated/60 overflow-hidden flex flex-col items-center"
```

Single class addition. The `flex flex-col items-center` makes the card a flex column that centers its children (the thumbnail button and the action buttons row) horizontally.


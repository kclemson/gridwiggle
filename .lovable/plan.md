

# ThumbnailNavigator: Even Row Distribution

## Problem

The current flex-wrap layout leaves ragged gaps at the end of rows. Items have fixed pixel widths, so leftover space just pools at the right edge.

## Solution

Add `flex: 1 1 <calculatedWidth>px` to each card. This tells flexbox: "start at your natural width, but grow to share any leftover space on this row equally." The photo inside already uses `object-cover`, so a bit of extra width just reveals more of the image -- no distortion.

```text
Before (fixed widths, gap pools at right):
[portrait][landscape---][square-]
[wide---------][portrait]              <- ragged right edge

After (flex-grow distributes space):
[portrait-][landscape------][square--]
[wide-----------][portrait-----]       <- fills the row
```

## Technical Details

**File:** `src/components/ThumbnailNavigator.tsx`

### Single change: flex-grow on each card

Replace the explicit `style={{ width: calculatedWidth }}` on each card div with:

```
style={{ flex: `1 1 ${calculatedWidth}px` }}
```

This sets:
- `flex-grow: 1` -- take a share of leftover space
- `flex-shrink: 1` -- can shrink slightly if needed
- `flex-basis: ${calculatedWidth}px` -- start at the natural aspect-ratio width

Optionally add a `maxWidth` (e.g., `calculatedWidth * 1.8`) to prevent a single item on the last row from stretching absurdly wide across the whole container.

### What stays the same

- Flex-wrap container (no grid change)
- Natural aspect ratio determines each card's base width
- Card styling (border, rounded corners, toolbar)
- Crop overlays, hero badges, index numbers
- All button logic and interaction behavior
- `THUMBNAIL_HEIGHT` fixed at 85px
- Progressive loading

### Files changed

| File | Change |
|------|--------|
| `src/components/ThumbnailNavigator.tsx` | Change card `style` from fixed `width` to `flex: 1 1 <width>px` with optional `maxWidth` cap |


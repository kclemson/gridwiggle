

# ThumbnailNavigator: Four Fixes

## 1. Remove index numbers

Delete the index number badge (lines 175-178) from each thumbnail. It adds clutter without much utility.

## 2. Square corners on crop overlay border

The crop boundary border currently uses `rounded-sm` (line 164). Change it to no rounding since real crop rectangles have square corners.

**Line 164:** Change `rounded-sm` to remove it entirely.

## 3. Fix hover state on smart crop button not covering icons

The button uses a `span` wrapper with `gap-0.5` around the Sparkles+Crop icons. The hover background from the ghost Button only covers the button's own box, but the icons inside the span may poke out visually. Fix by removing the gap and ensuring the icons are tightly contained, or by adding explicit padding/sizing to the span so it stays within the button's hover area.

Specifically: the `[&_svg]:size-4` rule in `buttonVariants` forces all SVGs to 16px, but the Sparkles icon is set to `h-3 w-3` (12px) and Crop to `h-3.5 w-3.5` (14px). The CVA override wins, making both icons 16px and pushing them outside the 28px (h-7 w-7) button. Fix by overriding the SVG size rule on this specific button: add `[&_svg]:size-3` to the button className so the icons fit comfortably.

## 4. Make cards more distinguishable from background

The current card uses `bg-surface-elevated/30` at 30% opacity, which barely registers against the dark background. Two changes:

- Increase opacity: `bg-surface-elevated/60` 
- Slightly stronger border: `border-border/70` instead of `border-border/50`

This keeps the subtle look but makes the card boundary clearly visible.

## Technical Details

**File:** `src/components/ThumbnailNavigator.tsx`

| Line(s) | Change |
|---------|--------|
| 128 | Card classes: `border-border/50` -> `border-border/70`, `bg-surface-elevated/30` -> `bg-surface-elevated/60` |
| 164 | Crop border: remove `rounded-sm` |
| 175-178 | Delete the index number div entirely |
| 198 | Smart crop button: add `[&_svg]:size-3` to className to keep icons within hover bounds |

No other files changed. All layout, interaction, and progressive loading logic stays the same.


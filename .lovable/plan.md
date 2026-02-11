

# ThumbnailNavigator: Card-Based Photo+Action Grouping

## Problem

The buttons beneath each thumbnail float in space with no visual boundary connecting them to their photo. With 30+ photos of varying widths, this creates a chaotic layout where it's unclear which buttons belong to which photo.

## Solution

Wrap each photo and its action buttons in a **card container** with a subtle border and rounded corners. This creates a clear visual unit: one card = one photo + its actions. Buttons stay always visible, but the card boundary eliminates ambiguity.

```text
Current:                          Proposed:
+-------+ +----------+           +----------+ +-------------+
| photo | | photo    |           || photo  || || photo      ||
+-------+ +----------+           ||        || ||            ||
 [*C][E]   [Undo][E]             |+--------+| |+-----------+||
                                 | [*C] [E] | |  [Undo] [E] |
                                 +----------+ +-------------+
                                 (subtle border around each card)
```

## Technical Details

**File:** `src/components/ThumbnailNavigator.tsx`

### Change 1: Card wrapper around each photo unit

Replace the outer `div` per photo (currently `flex flex-col items-center gap-1`) with a styled container:

```
rounded-lg border border-border/50 bg-surface-elevated/30 overflow-hidden
```

This gives each photo+buttons group a subtle dark card background with a faint border, visually binding the thumbnail to its actions.

### Change 2: Button row styling

Give the button row a slight top border or background tint so it reads as a "toolbar" attached to its photo:

```
flex items-center justify-center gap-1 px-1 py-0.5 border-t border-border/30
```

### Change 3: Remove min-h/min-w overrides on buttons

The current `min-h-[44px] min-w-[44px]` on ghost buttons makes them oversized relative to the thumbnails. Inside a card, we can use slightly smaller visual size while keeping adequate touch targets via padding. Change to `h-7 w-7` visual size with padding maintaining the 44px touch target.

### What stays the same

- Flex-wrap layout with natural aspect ratios
- Crop boundary overlays on thumbnails
- Hero badges and index numbers
- Progressive loading
- All button logic (smartCropAttempted hiding, Sparkles+Crop dual icon, Undo2, Maximize2)
- All existing interaction behavior

### Files changed

| File | Change |
|------|--------|
| `src/components/ThumbnailNavigator.tsx` | Add card wrapper with border/bg around each photo+buttons unit, style button row as attached toolbar |


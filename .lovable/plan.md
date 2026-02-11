

# Tighten Icon-Text Spacing in PhotoStrip Buttons

## Problem

The buttons beneath the photo strip ("Adjust Crops", "Add Photos", "Generate", "Clear All") have too much space between their icon and label text, making it hard to tell which icon belongs to which button.

## Cause

Two sources of gap are stacking:
1. The `Button` component's CVA base class includes `gap-2` (8px) between children
2. Each icon also has `mr-1.5` (6px) margin-right

Together that's ~14px of separation -- too much.

## Fix

**File:** `src/components/PhotoStrip.tsx`

Remove the `mr-1.5` class from every icon in the action buttons. The Button's built-in `gap-2` already provides spacing; the extra margin is redundant and creates the visual disconnect.

| Line | Current | New |
|------|---------|-----|
| ~68 | `<Crop className="h-4 w-4 mr-1.5" />` | `<Crop className="h-4 w-4" />` |
| ~72 | `<Plus className="h-4 w-4 mr-1.5" />` | `<Plus className="h-4 w-4" />` |
| ~77 | `<Loader2 className="h-4 w-4 mr-1.5 animate-spin" />` | `<Loader2 className="h-4 w-4 animate-spin" />` |
| ~79 | `<Wand2 className="h-4 w-4 mr-1.5" />` | `<Wand2 className="h-4 w-4" />` |
| ~86 | `<Trash2 className="h-4 w-4 mr-1.5" />` | `<Trash2 className="h-4 w-4" />` |

No other files changed.


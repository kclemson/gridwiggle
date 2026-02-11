

# Fix Invisible Hero Toggle in Unchecked State

## Problem

The Switch component's unchecked (off) state uses `bg-input` which maps to the same dark tone as the dialog footer background, making it completely invisible when toggled off.

## Fix

**File:** `src/components/ui/switch.tsx`

Add a visible border to the switch track so it's always distinguishable from the background, even in the unchecked state. Change `border-2 border-transparent` to `border-2 border-muted-foreground/30` in the Root className. This adds a subtle border that provides contrast in both light and dark themes without changing the checked appearance.

| Current | New |
|---------|-----|
| `border-2 border-transparent` | `border-2 border-muted-foreground/30` |

Single line change in the Switch component (~line 13).


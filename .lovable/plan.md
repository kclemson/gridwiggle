

# Fix Switch Thumb Visibility in Unchecked State

## Problem

The switch thumb (circle) uses `bg-background` which is the same dark color as the dialog footer, making it invisible against the dark track in the off state.

## Fix

**File:** `src/components/ui/switch.tsx`

Add a visible border to the thumb so it stands out against the dark track background. Change the Thumb className to include `border border-muted-foreground/50`.

| Element | Current | New |
|---------|---------|-----|
| Thumb (line ~20) | `bg-background shadow-lg ring-0` | `bg-background shadow-lg ring-0 border border-muted-foreground/50` |

This gives the circle a subtle outline so it's always visible regardless of track color, while still looking clean when the switch is checked.


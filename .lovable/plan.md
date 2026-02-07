

# Change App Background to Dark Charcoal

## Goal
Make the default black (`#000000`) collage background visible against the app background by changing the app from near-black to a lighter dark charcoal.

## Current State
- **App background**: `hsl(240, 10%, 10%)` - very dark blue-gray (~10% lightness)
- **Collage default**: `#000000` (pure black, 0% lightness)

The contrast between 10% and 0% lightness is minimal - they look nearly identical.

## Solution
Increase the app background lightness to ~18-20% to create visible contrast with the black collage.

---

## Technical Changes

### File: `src/index.css`

Update the `--background` CSS variable in both `:root` and `.dark` sections:

```css
/* Line 9 (in :root) */
--background: 240 10% 10%;
/* Change to: */
--background: 240 8% 18%;

/* Line 56 (in .dark) */  
--background: 240 10% 10%;
/* Change to: */
--background: 240 8% 18%;
```

This changes the background from ~10% lightness to ~18% lightness, creating a visible dark charcoal that contrasts well with pure black.

---

## Visual Result
- **Before**: App background and collage background both appear nearly black
- **After**: App is a visible charcoal gray, collage stands out as distinctly darker/black


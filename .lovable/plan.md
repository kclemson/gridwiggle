
# Constrain Entire App to 512px Width

## Overview

Cap the entire app UI to a maximum width of 512px, creating a mobile-app-like experience that looks clean on all screen sizes. This is a simple change to the container configuration in Tailwind.

---

## Current Behavior

The Tailwind container is configured to expand to 1400px on large screens:

```typescript
container: {
  center: true,
  padding: "1rem",
  screens: {
    "2xl": "1400px",  // This is why everything is huge
  },
},
```

The `container` class is applied to:
- Header content (`<div className="container ...">`)
- Main content (`<main className="container ...">`)

---

## Solution

Update the Tailwind container config to cap at 512px for all screen sizes:

```typescript
container: {
  center: true,
  padding: "1rem",
  screens: {
    sm: "512px",
    md: "512px",
    lg: "512px",
    xl: "512px",
    "2xl": "512px",
  },
},
```

This ensures the entire app (header, photo grids, settings, collage preview, buttons) stays within 512px and is centered on larger screens.

---

## Files to Modify

| File | Change |
|------|--------|
| `tailwind.config.ts` | Update container screens to cap at 512px |

---

## Visual Result

**Before (large screen)**:
- App spans up to 1400px
- Thumbnails are ~180-280px each
- Settings slider stretches across the full width

**After (large screen)**:
- App capped at 512px, centered on screen
- Thumbnails are ~80-100px each (5 columns in 512px)
- Compact, mobile-like experience on all devices
- Dark background visible on sides, app content centered

---

## Technical Notes

- On mobile (< 512px), the app will still use full width minus 1rem padding on each side
- On larger screens, the app will be 512px wide and centered
- No changes needed to individual components since they all use the `container` class
- The collage preview will also be constrained, which keeps it proportional to the thumbnails

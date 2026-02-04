

# Always-Visible Hero Star for Screenshots

## Overview

Make the yellow hero star indicator always visible on the collage preview so it's obvious in screenshots which photo is the hero.

## Current Behavior

```typescript
"opacity-70 md:opacity-0 md:group-hover:opacity-100"
```

- Mobile: Always 70% opacity
- Desktop: Hidden until hover

## Proposed Change

```typescript
photo.priority === 1 
  ? "opacity-100"  // Hero star always fully visible
  : "opacity-70 md:opacity-0 md:group-hover:opacity-100"  // Non-hero stars keep hover behavior
```

This makes the filled yellow star (hero indicator) always visible, while the empty star toggle buttons remain hover-only on desktop.

## File Changes

| File | Change |
|------|--------|
| `src/components/CollagePreview.tsx` | Update line 172 opacity classes to always show when photo is hero |

## Result

- Hero photos will have a permanently visible filled yellow star
- Non-hero photos keep the hover-to-reveal behavior for toggling
- Screenshots will clearly show which photo is the hero


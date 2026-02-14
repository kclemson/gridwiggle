

# Raise Shape Slider Threshold to 10

## Why 10

The shape slider covers the full range from portrait through square to landscape. Square has the tightest tolerance (plus/minus 5%), requiring the most photos for the engine to reliably hit. Since the slider can reach square positions, the threshold should match the hardest case: 10 photos.

This avoids a situation where a user with 8-9 photos drags the slider to a square-ish position and gets a poor layout.

## Change

**`src/types/collage.ts`**: Update the constant:

```typescript
export const MIN_PHOTOS_FOR_SHAPE_SLIDER = 10;
```

Single-line change. All UI logic (disabled state, tooltip message, auto-reset on photo removal) already references this constant, so everything updates automatically.


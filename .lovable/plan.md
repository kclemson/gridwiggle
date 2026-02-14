

# Disable Shape Slider Below Photo Count Threshold

## Design intent

With few photos (2-5), the layout engine has very limited row-packing options. Constraining it to a specific aspect ratio often results in soft rejections or layouts far from the target. The slider should only be interactive when there are enough photos for the constraint to be meaningful.

## User experience

- With fewer than 6 photos: the shape slider is visually disabled (grayed out, non-interactive). The ShapeIndicator still reflects the current layout's AR, but the user can't drag.
- With 6+ photos: full slider interaction as currently implemented.
- If the user has a shape constraint active and removes photos below the threshold, `shapeSlider` resets to `null` (same pattern as the old system).

## Threshold choice: 6 photos

- 2-3 photos: only 1-2 possible row arrangements
- 4-5 photos: a handful of arrangements, AR mostly dictated by photo orientations
- 6+: enough combinatorial flexibility that AR constraints are achievable within the +/-20% tolerance window

## Technical changes

### 1. `src/types/collage.ts`
Add constant:
```typescript
export const MIN_PHOTOS_FOR_SHAPE_SLIDER = 6;
```

### 2. `src/components/CollageSettings.tsx`
- Accept `photoCount: number` as a new prop
- Compute `const shapeDisabled = photoCount < MIN_PHOTOS_FOR_SHAPE_SLIDER`
- Pass `disabled={shapeDisabled}` to the shape Slider
- When disabled, add `opacity-40 pointer-events-none` to the ShapeIndicator + Slider wrapper
- Slider still displays the current layout AR (truthful) but is non-interactive

### 3. `src/pages/Index.tsx`
- Pass `photoCount={state.photos.length}` to `CollageSettings`
- In `handleRemovePhoto` (or wherever photos are removed): if the remaining count drops below 6 and `shapeSlider` is not null, reset it: `updateSettings({ shapeSlider: null })`

### 4. No other changes
The generation hook already handles `shapeSlider: null` correctly (no constraint). The ShapeIndicator and display position logic remain unchanged.


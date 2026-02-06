
# Remove SmartCrop Simulation

## Goal

Remove the `applySmartCropVariation` function and all calls to it. This eliminates the logic that pulls aspect ratios toward 1.0 (square), which was identified as a major contributor to the portrait bias.

## Changes

### File: `src/test/layout/photoGenerator.ts`

1. **Delete** the `applySmartCropVariation` function (lines 14-21)

2. **Remove** the `smartCropRatio` parameter from `generatePhotoSet` (line 73)

3. **Simplify** the photo generation loop to just use `sampleAspectRatio` directly:

```typescript
export function generatePhotoSet(
  count: number,
  orientationBias: number,
  hasHero: boolean
): SyntheticPhoto[] {
  const photos: SyntheticPhoto[] = [];
  
  for (let i = 0; i < count; i++) {
    const isHero = hasHero && i === 0;
    let aspectRatio: number;
    
    if (isHero) {
      // Hero biased toward landscape/square
      aspectRatio = sampleAspectRatio(0.3 + Math.random() * 0.4);
    } else {
      aspectRatio = sampleAspectRatio(orientationBias);
    }
    
    photos.push(createSyntheticPhoto(
      `photo-${i + 1}`,
      aspectRatio,
      isHero ? 1 : 3
    ));
  }
  
  return photos;
}
```

## What This Removes

- The `applySmartCropVariation` function that was pulling 50% of photos toward square
- The `smartCropRatio` parameter (unused after this change)
- All conditional calls to smart crop simulation

## Expected Outcome

With only the triangular distribution sampling (centered by `orientationBias`), we should see:
- More extreme aspect ratios preserved (very portrait and very landscape)
- Better variety in canvas shapes
- The `orientationBias` having its intended effect without being dampened

After this change, reset the session and page through to see if we get more variety. If still too portrait-heavy, we can then consider switching to uniform sampling.

## Files Modified

| File | Changes |
|------|---------|
| `src/test/layout/photoGenerator.ts` | Remove `applySmartCropVariation` and all calls to it |



## Change: Use Full Image When No Subjects Detected

### Current Behavior
When DETR doesn't detect any objects with confidence > 0.4, the worker returns a 10% edge crop:
```typescript
return {
  x: Math.round(originalWidth * 0.1),
  y: Math.round(originalHeight * 0.1),
  width: Math.round(originalWidth * 0.8),
  height: Math.round(originalHeight * 0.8)
};
```

### New Behavior
Return the full image dimensions - no cropping applied:
```typescript
return {
  x: 0,
  y: 0,
  width: originalWidth,
  height: originalHeight
};
```

### Technical Change

**File: `src/workers/visionWorker.ts`**

Update the `calculateOptimalCrop` function's fallback case (around line 45):

```typescript
if (subjects.length === 0) {
  // No subjects detected - use full image (no cropping)
  return {
    x: 0,
    y: 0,
    width: originalWidth,
    height: originalHeight
  };
}
```

### Changes Summary

| File | Change |
|------|--------|
| `src/workers/visionWorker.ts` | Change no-detection fallback from 10% edge crop to full image |

### Result
- Cartoon images like Lisa Simpson will appear in Smart Cropped grid unchanged
- Photos with detectable subjects still get intelligent cropping
- User can manually adjust any crop via the editor if desired


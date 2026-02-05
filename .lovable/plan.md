

# Fix: Crop Editor Defaults + Handle Sizing + Console Cleanup

## Summary

Three issues found:
1. **Console logs**: Many `[Hero]` debug logs throughout layout algorithms
2. **Crop defaults to square**: When no smart crop exists, editor defaults to a centered 80% square instead of full image
3. **Huge crop handles**: The Keanu photo shows oversized circles because handle size calculation uses `viewScale` which can be very small for low-resolution images

---

## Issue #1: Spammy Console Logs

**Root Cause**: 23+ `console.log('[Hero]...')` statements throughout `heroLayout.ts` and `layoutBlocks.ts` used for development debugging.

**Files**:
- `src/lib/heroLayout.ts` - ~15 console.log calls
- `src/lib/layoutBlocks.ts` - ~3 console.log calls
- `src/hooks/useCollageState.ts` - 1 console.log call

**Solution**: Remove all `console.log` statements from these files. The DebugPanel already captures these logs via `captureHeroLogs` in `debugLogger.ts`, so they're still available in dev mode when needed.

---

## Issue #2: Crop Editor Defaults to Centered Square

**Root Cause**: In `src/lib/cropUtils.ts`, `getEditorInitialCrop()` defaults to a centered 80% square when no crop exists:

```typescript
// Current behavior (lines 78-85)
const size = Math.min(photo.originalWidth, photo.originalHeight) * 0.8;
return {
  x: (photo.originalWidth - size) / 2,
  y: (photo.originalHeight - size) / 2,
  width: size,
  height: size,
};
```

This causes the Fry meme (landscape) to show a square crop in the center instead of the full image.

**Solution**: Default to full image dimensions when no crop exists:

```typescript
// New behavior - full image as default
return {
  x: 0,
  y: 0,
  width: photo.originalWidth,
  height: photo.originalHeight,
};
```

This way:
- Users see the full image with handles at the edges
- Handles remain grabbable at corners
- No cropping by default - users only crop if they want to

---

## Issue #3: Oversized Crop Handle Circles

**Root Cause**: In `CropEditor.tsx`, handle size is calculated as:

```typescript
const handleSize = viewScale > 0 ? 20 / viewScale : 20;
```

`viewScale` = `renderedSVGWidth / photo.originalWidth`

For the Keanu "whoa" meme (which appears to be a small image, maybe 200x200px), if the rendered SVG is ~400px wide and the original is 200px, then `viewScale = 2`, and `handleSize = 20/2 = 10` viewBox units.

But if the image is very low resolution (say 100px wide) rendered at 600px, then `viewScale = 6` and `handleSize = 20/6 = 3.3` viewBox units, which appears tiny.

Looking at the screenshot, the opposite is happening: the circles are **huge**. This means `viewScale` is very small (like 0.2), making `handleSize = 20/0.2 = 100` viewBox units.

This happens when:
- The image is very high resolution (e.g., 4000px wide)
- But renders in a small space (e.g., 800px dialog)

**Solution**: Clamp handle size to reasonable viewBox-unit bounds:

```typescript
// Ensure handles are 10-40px on screen (reasonable range)
const rawHandleSize = viewScale > 0 ? 20 / viewScale : 20;
const handleSize = Math.max(rawHandleSize, 10 / viewScale) // At least 10px on screen
                    && Math.min(rawHandleSize, 40 / viewScale); // At most 40px on screen
```

Simpler approach - clamp in viewBox units based on image size:

```typescript
const minHandlePx = 10;  // Min screen pixels
const maxHandlePx = 40;  // Max screen pixels
const minViewBoxUnits = viewScale > 0 ? minHandlePx / viewScale : minHandlePx;
const maxViewBoxUnits = viewScale > 0 ? maxHandlePx / viewScale : maxHandlePx;
const handleSize = Math.min(maxViewBoxUnits, Math.max(minViewBoxUnits, 20 / viewScale));
```

Or even simpler - just cap the maximum:

```typescript
// Cap handle size to prevent absurdly large circles
const targetScreenPx = 20;
const maxScreenPx = 40;
const handleSize = viewScale > 0 
  ? Math.min(maxScreenPx / viewScale, targetScreenPx / viewScale)
  : 20;
```

Wait, that's the same thing. The real fix:

```typescript
// Handle size: target 20px on screen, but cap at 5% of smaller image dimension
const targetHandleSize = viewScale > 0 ? 20 / viewScale : 20;
const maxHandleSize = Math.min(photo.originalWidth, photo.originalHeight) * 0.05;
const handleSize = Math.min(targetHandleSize, maxHandleSize);
```

This ensures handles never exceed 5% of the image's smaller dimension, preventing the oversized circles on small images.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/cropUtils.ts` | Change default crop from centered 80% square to full image |
| `src/components/CropEditor.tsx` | Clamp handle size to max 5% of smaller dimension |
| `src/lib/heroLayout.ts` | Remove all `console.log` statements |
| `src/lib/layoutBlocks.ts` | Remove all `console.log` statements |
| `src/hooks/useCollageState.ts` | Remove `console.log` statement |

---

## Technical Details

### cropUtils.ts Change

```text
// Line 78-85: Replace
const size = Math.min(photo.originalWidth, photo.originalHeight) * 0.8;
return {
  x: (photo.originalWidth - size) / 2,
  y: (photo.originalHeight - size) / 2,
  width: size,
  height: size,
};

// With:
return {
  x: 0,
  y: 0,
  width: photo.originalWidth,
  height: photo.originalHeight,
};
```

### CropEditor.tsx Handle Size Change

```text
// Line 136-138: Replace
const handleSize = viewScale > 0 ? 20 / viewScale : 20;

// With:
const targetHandleSize = viewScale > 0 ? 20 / viewScale : 20;
const maxHandleSize = Math.min(photo.originalWidth, photo.originalHeight) * 0.05;
const handleSize = Math.min(targetHandleSize, maxHandleSize);
```

### Console Log Removal

Remove all lines matching `console.log('[Hero]...` and `console.log('[useCollageState]...` from:
- `src/lib/heroLayout.ts` (~15 occurrences)
- `src/lib/layoutBlocks.ts` (~3 occurrences)  
- `src/hooks/useCollageState.ts` (~1 occurrence)

---

## Expected Behavior After Fix

| Issue | Before | After |
|-------|--------|-------|
| Console logs | 20+ debug logs on every layout | Silent (logs still captured in DebugPanel) |
| Fry meme crop | Square in center | Full image, handles at edges |
| Keanu handles | Huge circles overflowing image | Proportional circles capped at 5% of image size |


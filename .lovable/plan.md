

# Fix Crop Editor Viewport Resize Issue

The crop handles don't update their positions when the browser viewport is resized because the `scale` value is computed once at render time and never recalculated when the image dimensions change.

---

## Root Cause

```typescript
// Line 134 - computed once per render
const scale = getScale();

// Lines 170-173 - uses stale scale value
style={{
  left: crop.x * scale,
  top: crop.y * scale,
  width: crop.width * scale,
  height: crop.height * scale,
}}
```

When viewport resizes:
1. The `<img>` element resizes (CSS `max-width/max-height` causes it to fit new container)
2. `imageRef.current.width` now returns a different value
3. BUT React doesn't re-render because no state changed
4. The crop overlay uses the OLD scale value, so it's positioned incorrectly

---

## Solution

Add a resize observer to track when the image element's dimensions change, and store the current scale in state to trigger re-renders.

```text
On image load OR resize:
  - Read imageRef.current.width
  - Compute new scale
  - Store in state -> triggers re-render -> overlay repositions
```

---

## File Changes

### `src/components/CropEditor.tsx`

1. **Add `scale` state** instead of computing inline:
   ```typescript
   const [scale, setScale] = useState(1);
   ```

2. **Add a function to update scale**:
   ```typescript
   const updateScale = useCallback(() => {
     if (imageRef.current && photo.originalWidth > 0) {
       setScale(imageRef.current.width / photo.originalWidth);
     }
   }, [photo.originalWidth]);
   ```

3. **Call updateScale on image load**:
   ```typescript
   onLoad={() => {
     setImageLoaded(true);
     updateScale();
   }}
   ```

4. **Add ResizeObserver to track image size changes**:
   ```typescript
   useEffect(() => {
     const img = imageRef.current;
     if (!img) return;
     
     const resizeObserver = new ResizeObserver(() => {
       updateScale();
     });
     
     resizeObserver.observe(img);
     return () => resizeObserver.disconnect();
   }, [updateScale]);
   ```

5. **Remove inline `getScale()` call** at line 134 since scale is now in state.

---

## Why ResizeObserver?

- `window.resize` event: Only fires when the window resizes, not when dialog/container resizes
- Polling: Wasteful and introduces lag
- **ResizeObserver**: Native browser API that efficiently notifies when an element's dimensions change

---

## Before/After

| Viewport Resize | Before | After |
|-----------------|--------|-------|
| Image shrinks | Crop overlay stays same size (wrong) | Crop overlay shrinks proportionally (correct) |
| Image grows | Crop overlay stays same size (wrong) | Crop overlay grows proportionally (correct) |

This is a legitimate use of useEffect - it synchronizes React state with an external system (DOM element dimensions via ResizeObserver).


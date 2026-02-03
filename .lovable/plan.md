

# Fix Corner Handle Resizing - Event Propagation Issue

The corner handles can't resize the crop because click events on handles bubble up to the parent crop box, which triggers the "move" handler instead of the "resize" handler.

---

## Root Cause

Looking at lines 187-200:

```typescript
{/* Corner handles are INSIDE the crop box */}
<div onMouseDown={(e) => handlePointerDown(e, 'move')}>  {/* Parent catches all clicks */}
  {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
    <div
      onMouseDown={(e) => handlePointerDown(e, `resize-${corner}`)}  {/* Handle click */}
      ...
    />
  ))}
</div>
```

When you click a corner handle:
1. The handle's `onMouseDown` fires with `resize-nw` (correct)
2. Event bubbles to parent crop box
3. Parent's `onMouseDown` fires with `move` (overwrites!)
4. `dragType` becomes `'move'` instead of `'resize-nw'`

---

## Solution

Add `e.stopPropagation()` to the corner handle event handlers to prevent the event from bubbling up to the parent "move" handler.

---

## File Changes

### `src/components/CropEditor.tsx`

**Lines 197-198 - Update corner handle event handlers:**

```typescript
// Before:
onMouseDown={(e) => handlePointerDown(e, `resize-${corner}`)}
onTouchStart={(e) => handlePointerDown(e, `resize-${corner}`)}

// After:
onMouseDown={(e) => {
  e.stopPropagation();
  handlePointerDown(e, `resize-${corner}`);
}}
onTouchStart={(e) => {
  e.stopPropagation();
  handlePointerDown(e, `resize-${corner}`);
}}
```

This ensures the resize handler fires and the event doesn't bubble up to trigger the move handler.

---

## Why This Works

| Before | After |
|--------|-------|
| Click handle → resize fires → bubbles → move fires → dragType = 'move' | Click handle → resize fires → stopPropagation → dragType = 'resize-nw' |
| User sees crop box moving instead of resizing | User can freely resize each corner independently |

---

## Summary

Single change: Add `e.stopPropagation()` to corner handle mouse/touch down events. This allows the user to drag any corner to resize the crop box in any direction, changing the aspect ratio as needed.


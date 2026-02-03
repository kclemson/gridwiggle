

# Fix Crop Editor - Three Issues

The crop editor has three bugs that prevent it from working correctly. The data model is fine - the issues are purely in `CropEditor.tsx`.

---

## Issue Analysis

### Issue #1: Image Inside Crop Area is Grayed Out

**Root Cause (lines 162-164):**
```typescript
{/* Darkened overlay */}
<div className="absolute inset-0 bg-black/60 pointer-events-none" />
```

This div covers the ENTIRE image with 60% black. Then the crop box uses `boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'` to darken the area OUTSIDE the crop. These two overlays stack, making the crop area appear dimmed.

**Fix:** Remove the full-image overlay div entirely. The box-shadow technique already handles darkening the area outside the crop box - the crop box interior stays clear because box-shadow renders outside the element.

---

### Issue #2: Handles Won't Move Properly

**Root Cause (lines 84-117):**
```typescript
const dx = pos.x - dragStart.x;
const dy = pos.y - dragStart.y;
// ... calculate new crop ...
setDragStart(pos);  // <-- BUG: Resets reference on every frame
```

The code updates `dragStart` on every mousemove. This means:
1. Frame 1: Mouse moves 5px, delta = 5, crop moves 5px, dragStart resets
2. Frame 2: Mouse moves 2px more, delta = 2, crop moves 2px, dragStart resets
3. Problem: If mouse moves 50px total but we update dragStart each frame, we only see tiny increments

This works for MOVE (dragging the whole box), but fails for RESIZE because resize needs to track the delta from the ORIGINAL crop position, not cumulative small deltas.

**Fix:** Store the original crop position when drag starts, then calculate absolute delta from original mouse position to current mouse position, and apply that delta to the original crop.

---

### Issue #3: Crop Not Expanding Beyond Smart Crop

This is actually working correctly - the user CAN drag handles to expand beyond the original smart crop. The issue is #2 preventing the handles from moving at all.

---

## Solution: Refactor Drag Logic

Change from incremental delta updates to absolute positioning:

```text
On mousedown:
  - Store original mouse position
  - Store original crop region (as snapshot)

On mousemove:
  - Calculate delta from original mouse position (not last position)
  - Apply delta to original crop snapshot (not current crop)
  - This gives smooth, predictable movement
```

---

## File Changes

### `src/components/CropEditor.tsx`

1. **Remove the broken overlay** (line 163-164):
   - Delete the `<div className="absolute inset-0 bg-black/60 pointer-events-none" />` entirely

2. **Fix drag state to store original positions**:
   - Add `cropStart` state to store the crop region when drag begins
   - Update `handlePointerDown` to capture both mouse position AND crop region
   - Update `handlePointerMove` to use original positions for delta calculation
   - Remove the `setDragStart(pos)` update inside handlePointerMove

3. **Fix handle z-index/pointer events**:
   - Ensure corner handles have higher z-index so they're clickable
   - Make handles larger touch targets on mobile

---

## Before/After

**Before (grayed interior, handles stuck):**
```text
┌─────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  <- Full dark overlay
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░┌──────────────────┐░░░░░░░░░ │
│ ░░│  (crop + shadow) │░░░░░░░░░ │  <- Box shadow ADDS more dark
│ ░░│  Result: DOUBLE  │░░░░░░░░░ │
│ ░░│  DARKNESS inside │░░░░░░░░░ │
│ ░░└──────────────────┘░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────┘
```

**After (clear interior, handles work):**
```text
┌─────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  <- Only box-shadow darkens outside
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░┌──────────────────┐░░░░░░░░░ │
│ ░░│  CLEAR VIEW OF   │░░░░░░░░░ │  <- No overlay inside crop
│ ░░│  ORIGINAL PHOTO  │░░░░░░░░░ │
│ ░░│  (handles work)  │░░░░░░░░░ │
│ ░░└──────────────────┘░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────┘
```

---

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Gray inside crop | Two overlapping dark overlays | Remove the full-image overlay div |
| Handles barely move | Resetting dragStart on every frame | Store original crop + mouse at drag start, calculate absolute delta |
| Can't expand crop | (Same as above) | Fixed by #2 |


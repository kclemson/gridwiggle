
# Fix Crop Handle Positioning at Image Edges

## Problem Summary

The crop editor handles appear offset from the actual corners when the crop region touches the image edge. This happens because `getHandlePosition` intentionally pushes handles inward by `handleRadius` to keep them inside the SVG viewBox. However, this makes the UI look buggy - handles appear to "jump" to the correct corner once dragging starts.

Looking at the screenshots:
- In image 1 (mobile): handles are visibly inside the corners at the edges
- In images 2-3 (desktop): when crop is full-frame, all corners are offset inward

---

## Design Intent

**What behavior do we want?**
- Corner handles always render exactly at the crop corners
- Handles can extend beyond the image boundary if needed (using SVG overflow)
- No visual "jumping" when starting to drag

**What will users experience?**
- Handles are precisely at corners, even when crop equals full image
- Consistent, non-buggy appearance
- Handles remain fully visible (just extend past image edge into the dialog padding)

---

## Technical Approach

The SVG element has padding around it (`p-4` on the container), so handles extending beyond the viewBox will still be visible in that padding area. We just need to:

1. **Remove the inward offset logic** in `getHandlePosition`
2. **Add `overflow="visible"`** to the SVG element so elements can render outside the viewBox

---

## Implementation Details

### File: `src/components/CropEditor.tsx`

**Change 1: Simplify `getHandlePosition` (lines 197-210)**

Remove the offset logic entirely - handles always at true corner:

```typescript
// Before (lines 197-210)
const getHandlePosition = (corner: 'nw' | 'ne' | 'sw' | 'se') => {
  const handleRadius = handleSize / 2;
  let cx = corner.includes('e') ? crop.x + crop.width : crop.x;
  let cy = corner.includes('s') ? crop.y + crop.height : crop.y;
  
  // Offset inward if at image edge
  if (corner.includes('w') && crop.x <= 0) cx += handleRadius;
  if (corner.includes('e') && crop.x + crop.width >= photo.originalWidth) cx -= handleRadius;
  if (corner.includes('n') && crop.y <= 0) cy += handleRadius;
  if (corner.includes('s') && crop.y + crop.height >= photo.originalHeight) cy -= handleRadius;
  
  return { cx, cy };
};

// After - simple, no offset
const getHandlePosition = (corner: 'nw' | 'ne' | 'sw' | 'se') => {
  const cx = corner.includes('e') ? crop.x + crop.width : crop.x;
  const cy = corner.includes('s') ? crop.y + crop.height : crop.y;
  return { cx, cy };
};
```

**Change 2: Add `overflow="visible"` to SVG (line 223-228)**

```tsx
// Before
<svg
  ref={svgRef}
  viewBox={`0 0 ${photo.originalWidth} ${photo.originalHeight}`}
  preserveAspectRatio="xMidYMid meet"
  className="max-w-full block touch-none select-none"
  style={{ maxHeight: 'calc(90vh - 120px)' }}
  ...

// After - add overflow="visible"
<svg
  ref={svgRef}
  viewBox={`0 0 ${photo.originalWidth} ${photo.originalHeight}`}
  preserveAspectRatio="xMidYMid meet"
  overflow="visible"
  className="max-w-full block touch-none select-none"
  style={{ maxHeight: 'calc(90vh - 120px)', overflow: 'visible' }}
  ...
```

Note: We need both the SVG attribute AND the CSS style because some browsers respect one over the other.

---

## Visual Comparison

**Before (handles offset inward at edges):**
```
    ○─────────────────────○
    │                     │
    │      [image]        │   ← handles NOT at corners
    │                     │
    ○─────────────────────○
```

**After (handles at true corners):**
```
  ○───────────────────────○
  │                       │
  │       [image]         │   ← handles AT corners
  │                       │
  ○───────────────────────○
```

When handles extend beyond the image, they render into the dialog's `p-4` padding area - still fully visible.

---

## File Changes Summary

| Location | Change |
|----------|--------|
| Lines 197-210 | Simplify `getHandlePosition` - remove all offset logic |
| Line 223-228 | Add `overflow="visible"` attribute and CSS to SVG |

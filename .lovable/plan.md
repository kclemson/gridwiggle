
# Improve Crop Handle Touch Targets

## Problem

When the crop region covers the full image, the corner handles are positioned exactly at the image edges. Since handles are circles centered on the corner point, half of each handle is clipped outside the SVG viewport, making them difficult to select - especially on mobile where touch targets need to be larger.

## Solution

Two improvements to make handles easier to interact with:

### 1. Add Invisible Hit Area

Add a larger invisible circle behind each visible handle that acts as the actual touch/click target. This is a common pattern for small interactive elements - the visual stays small and precise, but the clickable area is much larger.

- Visible handle: Keep current size (~20px on screen, capped at 5% of image)
- Hit area: 44px minimum (iOS Human Interface Guidelines recommend 44pt for touch targets)

### 2. Offset Handles Inward When at Edges

When a handle is at the image edge (crop.x = 0 or crop.x + crop.width = originalWidth), offset the handle slightly inward so it's fully visible. This way users can see and interact with the complete handle even at full-image crop.

- Offset amount: Half the handle radius, so the full circle is visible

## Technical Changes

**File**: `src/components/CropEditor.tsx`

### Change 1: Calculate Hit Area Size
Add a larger hit target size (aim for ~44px on screen, but in viewBox units):

```tsx
// Minimum touch target of 44px in screen space
const hitAreaSize = viewScale > 0 ? 44 / viewScale : 44;
```

### Change 2: Calculate Edge Offsets
Determine if handle is at edge and needs to be offset inward:

```tsx
// Offset handles inward when at image edges so they're fully visible
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
```

### Change 3: Render Invisible Hit Area Behind Visible Handle

```tsx
{(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
  const { cx, cy } = getHandlePosition(corner);
  const cursorMap = { ... };
  
  return (
    <g key={corner}>
      {/* Invisible hit area - larger for easier touch/click */}
      <circle
        cx={cx}
        cy={cy}
        r={hitAreaSize / 2}
        fill="transparent"
        style={{ cursor: cursorMap[corner] }}
        onPointerDown={(e) => handlePointerDown(e, `resize-${corner}`)}
      />
      {/* Visible handle */}
      <circle
        cx={cx}
        cy={cy}
        r={handleSize / 2}
        fill="white"
        stroke="hsl(var(--primary))"
        strokeWidth={strokeWidth}
        style={{ cursor: cursorMap[corner], pointerEvents: 'none' }}
      />
    </g>
  );
})}
```

## Result

| Scenario | Before | After |
|----------|--------|-------|
| Handle at corner | Half clipped, hard to tap | Fully visible, offset inward |
| Touch target | ~20px visual only | 44px invisible hit area |
| Mobile usability | Difficult | Easy to tap |
| Desktop usability | Finicky | Comfortable |

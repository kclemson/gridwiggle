
# SVG-Based CropEditor Refactor with CollagePreview Integration

## Problem Summary
The Smart Cropped thumbnail and CropEditor show different crop regions because:
1. **Thumbnail** uses SVG viewBox (correct, unified coordinate system)
2. **CropEditor** uses HTML img + manual scale math that breaks with letterboxing

The scale calculation `img.width / photo.originalWidth` is correct for the image itself, but the overlay positioning fails to account for letterbox offsets when the image aspect ratio doesn't match the container.

## Solution: Unified SVG Coordinate System
Refactor CropEditor to use SVG with viewBox, matching the approach already working in CroppedImage. This eliminates manual scale math and ensures pixel-perfect alignment.

---

## Architecture Overview

### Current Flow
```text
PhotoGrid (Smart Cropped)
  └─ PhotoThumbnail
       └─ CroppedImage (SVG viewBox) ✅ Correct

CropEditor
  └─ HTML <img> + manual scale math ❌ Miscalculated

CollagePreview
  └─ CroppedImage (SVG viewBox) ✅ Correct
  └─ onCellClick → opens CropEditor for that photo
```

### Future Flow (with this refactor)
```text
PhotoGrid (Smart Cropped)
  └─ PhotoThumbnail
       └─ CroppedImage (SVG viewBox) ✅

CropEditor (SVG-based)
  └─ SVG viewBox + getScreenCTM() ✅ Same coordinate system

CollagePreview
  └─ CroppedImage (SVG viewBox) ✅
  └─ onCellClick → opens same CropEditor ✅
```

**Key insight:** The CropEditor is already being opened from CollagePreview via `onCellClick={setEditingPhotoId}`. The integration is already in place - we just need the editor to show the correct crop.

---

## Implementation Plan

### 1. Refactor CropEditor to SVG-Based Rendering

**File:** `src/components/CropEditor.tsx`

#### A. Replace HTML image with SVG canvas

Remove:
- `imageRef`, `imageLoaded`, `scale` state
- `updateScale`, ResizeObserver effect
- Complex `getEventPosition` bounding-rect math

Add:
- `svgRef = useRef<SVGSVGElement>(null)`
- SVG with `viewBox="0 0 {originalWidth} {originalHeight}"`
- All coordinates in original image pixels (same as crop data)

#### B. SVG Structure

```tsx
<svg
  ref={svgRef}
  viewBox={`0 0 ${photo.originalWidth} ${photo.originalHeight}`}
  preserveAspectRatio="xMidYMid meet"
  className="w-full h-full block cursor-crosshair"
  style={{ maxHeight: 'calc(90vh - 140px)' }}
>
  {/* Full image */}
  <image 
    href={photo.objectUrl} 
    x="0" y="0" 
    width={photo.originalWidth} 
    height={photo.originalHeight}
  />
  
  {/* Darkening overlay (4 rects outside crop) */}
  <rect x="0" y="0" width={photo.originalWidth} height={crop.y} fill="rgba(0,0,0,0.6)" />
  {/* ... 3 more rects for bottom, left, right */}
  
  {/* Crop rectangle */}
  <rect 
    x={crop.x} y={crop.y} 
    width={crop.width} height={crop.height}
    fill="none" stroke="white" strokeWidth={2 / currentScale}
  />
  
  {/* Grid lines and corner handles */}
</svg>
```

#### C. Pointer Event Handling with getScreenCTM()

```tsx
const getEventPosition = useCallback((e: React.PointerEvent) => {
  const svg = svgRef.current;
  if (!svg) return { x: 0, y: 0 };
  
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  
  const cursor = pt.matrixTransform(ctm.inverse());
  return { x: cursor.x, y: cursor.y };
}, []);
```

This automatically handles:
- Letterboxing offsets
- Any CSS transforms/scaling
- Responsive container resizing

#### D. Handle Sizes

Corner handles need to be sized in screen pixels, not viewBox pixels:
```tsx
// Compute current scale for handle sizing
const [viewScale, setViewScale] = useState(1);

// ResizeObserver on SVG to track viewScale
useEffect(() => {
  const svg = svgRef.current;
  if (!svg) return;
  
  const observer = new ResizeObserver(() => {
    const rect = svg.getBoundingClientRect();
    setViewScale(rect.width / photo.originalWidth);
  });
  observer.observe(svg);
  return () => observer.disconnect();
}, [photo.originalWidth]);

// Handle size in viewBox units (appears as 20px on screen)
const handleSize = 20 / viewScale;
```

---

### 2. Add DialogDescription for Accessibility

The console shows a Radix warning about missing description. Add:

```tsx
<DialogHeader>
  <DialogTitle>Adjust Crop</DialogTitle>
  <DialogDescription className="sr-only">
    Drag the crop area to reposition, or drag corners to resize
  </DialogDescription>
</DialogHeader>
```

---

### 3. Ensure CollagePreview Integration Works

**Current state:** Already works via `onCellClick={setEditingPhotoId}`

**No changes needed** - but verify after refactor:
1. Click a cell in CollagePreview
2. CropEditor opens with correct crop displayed
3. Make adjustment, save
4. Both CollagePreview and Smart Cropped grid update

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/CropEditor.tsx` | Complete refactor to SVG-based rendering |
| `src/components/ui/dialog.tsx` | (Optional) Already has DialogDescription export |

---

## Visual Behavior After Refactor

| Context | Crop Display | Notes |
|---------|--------------|-------|
| Smart Cropped grid | SVG viewBox, contain | Shows full crop with letterboxing |
| CropEditor | SVG viewBox, crop overlay | **Now matches thumbnail exactly** |
| CollagePreview cells | SVG viewBox, cover | Fills cell, may clip |

---

## Edge Cases Handled

1. **Letterboxing:** SVG's preserveAspectRatio handles this automatically
2. **Touch devices:** Pointer events work across mouse/touch
3. **Responsive resize:** ResizeObserver updates handle sizes
4. **Very small crops:** Min size of 50px enforced in drag logic
5. **Different image aspect ratios:** All math is in original pixels

---

## Test Plan

1. Upload the pineapple photo (or any photo)
2. Observe Smart Cropped thumbnail
3. Click to open CropEditor
4. **Verify:** Crop overlay boundaries match exactly what thumbnail shows
5. Drag to adjust crop
6. Save
7. **Verify:** Thumbnail updates to show new crop accurately
8. Create collage
9. Click cell in CollagePreview
10. **Verify:** CropEditor shows correct crop for that photo
11. Adjust and save
12. **Verify:** Both collage cell and Smart Cropped grid update correctly

---

## Why This Approach Is Robust

1. **Single coordinate system** - Everything uses original image pixels
2. **Browser handles transforms** - SVG getScreenCTM() is battle-tested
3. **No fragile scale math** - Eliminates the class of bugs we've been fighting
4. **Matches existing CroppedImage** - Same SVG viewBox concept
5. **Future-proof** - Works regardless of container shape, CSS transforms, or device

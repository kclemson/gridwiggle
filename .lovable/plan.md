

# Fix Smart Cropped Image Stretching/Distortion

The smart cropped photos are being stretched because the `CroppedImage` component incorrectly calculates how to display a crop region within a container that has a different aspect ratio than the original image.

---

## Root Cause

The current code applies a uniform scale percentage to both width and height:

```text
scale = Math.min(scaleX, scaleY)
width: `${scale * 100}%`
height: `${scale * 100}%`
```

This breaks when:
- Container is square (1:1)
- Original image is not square (e.g., 4:3)
- Setting width/height to the same percentage of a square container distorts the image

**Example:**
- Original image: 1000x750 (4:3 aspect ratio)
- Crop region: 500x375 (same 4:3 aspect ratio)
- Container: 100x100 square
- Current code sets: width=200%, height=200% of container
- Result: 200x200 stretched image (now 1:1, distorted)

---

## Solution

The `CroppedImage` component needs to:

1. Preserve the original image's aspect ratio at all times
2. Scale and position so the crop region is visible and fills the container appropriately
3. Handle the mismatch between container aspect ratio and crop aspect ratio

### Correct Approach

Instead of using percentage-based sizing relative to the container, we need to:

1. Calculate how big the full image needs to be so that when we show only the crop region, it fills the container
2. Use absolute pixel calculations or proper aspect-ratio-aware scaling
3. Position the image so the crop region is centered in the container

**New algorithm:**

```text
// Container aspect ratio (from parent - we assume it fills available space)
// We need to scale the image so the CROP REGION fits in the container

// The crop region's aspect ratio
cropAspectRatio = crop.width / crop.height

// Scale image so crop region fills container (using contain logic)
// If crop is wider than container: fit to width
// If crop is taller than container: fit to height

// Then translate so crop region origin is at container origin
// Then center the crop region within container
```

---

## Files to Modify

### `src/components/common/CroppedImage.tsx`

Rewrite the cropped rendering logic to properly maintain aspect ratio:

1. The image should ALWAYS maintain its native aspect ratio (never set both width and height to arbitrary values)
2. Calculate the scale factor based on making the crop region fill the container
3. Use `object-fit: none` with `object-position` for positioning, OR
4. Use a more robust transform approach that accounts for container vs image aspect ratios

**Key fix:** Instead of setting both `width` and `height` as percentages, we should:
- Set only ONE dimension (e.g., width: 100% of what's needed)
- Let the browser calculate the other based on aspect ratio
- OR use transform: scale() which doesn't distort

**Correct transform approach:**

```text
// Calculate how much to scale the FULL image so the crop region 
// would be exactly the size of the container

// If container is 100x100 and crop is 200x150:
// We need the 200x150 crop to become 100x100 (scaled down)
// So the full image scales by: containerWidth / cropWidth = 0.5

// But we also need to handle contain vs cover fitting within the square container

// For 'contain' in a square container with a 4:3 crop:
// The crop's height will limit (letterboxed on sides)
// scaleToFit = containerSize / max(cropWidth, cropHeight) for contain-like
// OR we fit the larger dimension and letterbox

// Simpler approach: Use CSS clip-path or overflow:hidden with precise positioning
```

---

## Technical Implementation

### New `CroppedImage` Logic

```text
For cropped images:

1. Calculate the crop region's aspect ratio: cropAR = crop.width / crop.height

2. The image element should maintain its NATURAL aspect ratio
   - Use width: auto, height: auto as base
   - Scale using transform: scale(factor)

3. Calculate scale factor:
   - We want the crop region to fill the container
   - If container is W x H, and crop is CW x CH
   - Scale factor = min(W / CW, H / CH) for "contain" behavior
   - Since container might be square but crop isn't, this handles letterboxing

4. Position the image:
   - After scaling, image is at (fullWidth * scale, fullHeight * scale)
   - Translate so crop region's top-left is at container's top-left
   - translateX = -crop.x * scale
   - translateY = -crop.y * scale

5. Center within container (for contain behavior):
   - Calculate how much smaller the scaled crop is vs container
   - Add offset to center it
```

### Updated Component Structure

```text
// CroppedImage.tsx for crop case:

// Container clips to bounds
<div className="relative overflow-hidden w-full h-full">
  {/* Inner wrapper handles centering */}
  <div className="absolute inset-0 flex items-center justify-center">
    {/* Image with transform-based positioning */}
    <img
      src={src}
      style={{
        // Use transform: scale() which preserves aspect ratio
        // Combined with translate to position crop region
        transform: `scale(${scaleFactor}) translate(${tx}px, ${ty}px)`,
        transformOrigin: '0 0',
      }}
    />
  </div>
</div>
```

---

## Expected Result

After this fix:
- Smart cropped thumbnails will show the correct portion of the image
- Faces will NOT be stretched or squished
- The crop region will be displayed at its correct aspect ratio
- Letterboxing/pillarboxing will appear when the crop aspect ratio doesn't match the container



# Fix: Carousel Photo Aspect Ratio

## Problem

The carousel photo container uses `aspect-square` which forces all photos into a 1:1 ratio. This clips landscape and portrait photos, as shown in the eagle photo example where the wings are cut off.

## Solution

Change from a fixed square aspect ratio to a fixed height container with auto-adjusting width based on the photo's actual aspect ratio (from the crop region if available, otherwise from the original dimensions).

## Technical Change

**File**: `src/components/PhotoCarousel.tsx`

**Current** (lines 107-108):
```tsx
<div 
  className="aspect-square bg-muted relative cursor-pointer max-w-[180px] mx-auto"
```

**New approach**:
1. Calculate the photo's aspect ratio from the crop (or original dimensions)
2. Use a fixed height (180px) and let width adjust automatically
3. Center the container and constrain max-width to prevent oversized landscape images

```tsx
// Calculate aspect ratio from crop or original dimensions
const aspectRatio = crop 
  ? crop.width / crop.height 
  : photo.originalWidth / photo.originalHeight;

// Fixed height of 180px, width adjusts to aspect ratio
<div 
  className="h-[180px] bg-muted relative cursor-pointer mx-auto"
  style={{ width: `${180 * aspectRatio}px`, maxWidth: '100%' }}
  onClick={() => onPhotoClick(photo.id)}
>
```

This ensures:
- **Landscape photos**: Show full width, constrained by height (180px tall, wider than 180px)
- **Portrait photos**: Show full height, narrower than 180px
- **Square photos**: 180px × 180px (same as before)
- No clipping - the entire cropped region is always visible

## Visual Result

| Photo Type | Before | After |
|------------|--------|-------|
| Landscape | Clipped to square | Full photo visible, ~180px tall |
| Portrait | Clipped to square | Full photo visible, ~180px tall |
| Square | 180×180 | 180×180 (unchanged) |

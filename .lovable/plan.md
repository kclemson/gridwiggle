

## Fix: Remove Square Constraint and Show True Crop Aspect Ratios

### The Problem (Two Parts)

1. **Crop mismatch between thumbnail and editor**: The thumbnail shows the crop inside a square container, which distorts the visual representation. The user expects the thumbnail to show exactly what the crop editor shows.

2. **Unnecessary UX complexity**: Forcing everything into squares doesn't serve the user well. A clean row-based layout with consistent heights is more intuitive and directly shows the actual crop result.

### Solution Overview

Replace the rigid CSS grid of squares with a flexible row-based layout:
- Each thumbnail shows its TRUE aspect ratio (whether the crop is portrait, landscape, or square)
- All thumbnails in a row share the same HEIGHT
- Flexbox with `flex-wrap` handles the layout automatically
- Clean, consistent spacing between items

### Technical Implementation

**File 1: `src/components/PhotoGrid.tsx`**

Replace the CSS grid with a flexbox row layout:

```typescript
// Before: grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2
// After: flex flex-wrap gap-2

export function PhotoGrid({ photos, onRemove, onPhotoClick, showCropped, title, emptyMessage }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <PhotoThumbnail
            key={photo.id}
            photo={photo}
            onRemove={() => onRemove(photo.id)}
            onClick={onPhotoClick ? () => onPhotoClick(photo.id) : undefined}
            showCropped={showCropped}
            // New: fixed height, variable width
            height={80}
          />
        ))}
      </div>
    </div>
  );
}
```

**File 2: `src/components/PhotoThumbnail.tsx`**

Modify to use fixed height with natural aspect ratio:

```typescript
interface PhotoThumbnailProps {
  photo: PhotoItem;
  onRemove: () => void;
  onClick?: () => void;
  showCropped?: boolean;
  height?: number;  // Fixed height in pixels
  className?: string;
}

export function PhotoThumbnail({ photo, onRemove, onClick, showCropped, height = 80, className }) {
  const activeCrop = showCropped ? getDisplayCrop(photo) : null;
  
  // Calculate width based on aspect ratio
  // If cropped: use crop's aspect ratio
  // If not cropped: use original image's aspect ratio
  const aspectRatio = activeCrop 
    ? activeCrop.width / activeCrop.height 
    : photo.originalWidth / photo.originalHeight;
  
  const width = height * aspectRatio;

  return (
    <div
      className={cn(
        "relative group rounded-lg overflow-hidden bg-surface-elevated shrink-0",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
        className
      )}
      style={{ width, height }}
      onClick={onClick}
    >
      <CroppedImage
        src={photo.objectUrl}
        crop={showCropped ? activeCrop : null}
        originalWidth={photo.originalWidth}
        originalHeight={photo.originalHeight}
        fit="cover"  // Cover the container (no letterboxing)
      />
      {/* ... overlays and buttons stay the same ... */}
    </div>
  );
}
```

**File 3: `src/components/common/ImageContainer.tsx`**

This component can be simplified or may become unused - we'll use direct sizing instead.

### Visual Result

```
Before (forced squares):
┌────┐ ┌────┐ ┌────┐
│ ■■ │ │ ■■ │ │ ■■ │  ← All same size, letterboxing inside
│    │ │    │ │    │
└────┘ └────┘ └────┘

After (natural aspect ratios, same height):
┌──────────┐ ┌────┐ ┌──────┐
│          │ │    │ │      │  ← Same height, width varies by aspect
└──────────┘ └────┘ └──────┘
  landscape   portrait  square
```

### Changes Summary

| File | Change |
|------|--------|
| `PhotoGrid.tsx` | Replace CSS grid with `flex flex-wrap gap-2`, pass `height` prop |
| `PhotoThumbnail.tsx` | Calculate width from aspect ratio, use fixed height, remove `ImageContainer` |
| `ImageContainer.tsx` | May become unused (or keep for other uses) |

### Benefits

1. **WYSIWYG**: Thumbnail shows exactly what the crop editor shows - no distortion
2. **Simpler code**: No need for container aspect ratio tricks
3. **Better UX**: User immediately sees the actual crop shape
4. **Debugging clarity**: If thumbnail looks different from editor, it's a real bug - not a display artifact
5. **Clean rows**: Flexbox naturally creates organized rows with consistent spacing

### Edge Cases

- **Very wide panorama crops**: Will naturally take more horizontal space (acceptable)
- **Very tall portrait crops**: Will be narrower (acceptable)
- **Minimum width**: Could add a `minWidth` constraint if needed (e.g., 50px)
- **Single photo**: Will be left-aligned (can center if preferred)


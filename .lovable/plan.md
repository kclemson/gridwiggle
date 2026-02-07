
# Fix Spacing: Add Edge Padding via CSS

## What You'll Experience After This Fix

1. **Zero gap works**: When slider is at 0, photos touch each other AND touch the edges
2. **Edge padding matches inter-photo gap**: The background color appears around all edges at the same width as between photos

---

## The Simple Approach

Instead of modifying the layout algorithm's coordinate math, we just wrap the collage in a container with CSS padding. The layout algorithm outputs cells starting at (0,0) - we add the edge padding purely in the presentation layer.

## Technical Changes

### File 1: `src/components/CollagePreview.tsx`

**Add `gap` prop** (line 115-122):
```typescript
interface CollagePreviewProps {
  photos: PhotoItem[];
  layout: CollageLayout;
  gapColor: string;
  gap: number;  // NEW: pixel gap for edge padding
  onSwapPhotos: (photoId1: string, photoId2: string) => void;
  onCellClick?: (photoId: string) => void;
  onToggleHero?: (photoId: string) => void;
}
```

**Add padding to container** (lines 230-239):

The container needs padding, and the aspect ratio needs to account for the padding-expanded dimensions:

```typescript
// Compute padded dimensions for aspect ratio
const paddedWidth = layout.width + (2 * gap);
const paddedHeight = layout.height + (2 * gap);

<div
  ref={collageRef}
  className="relative mx-auto"
  style={{
    maxWidth: effectiveMaxWidth + (2 * gap),  // Expand max for padding
    width: '100%',
    aspectRatio: `${paddedWidth} / ${paddedHeight}`,
    backgroundColor: gapColor,
    padding: gap,  // Edge padding = inter-photo gap
  }}
>
```

### File 2: `src/pages/Index.tsx`

**Pass `gap` to CollagePreview** (lines 520-527):

```typescript
<CollagePreview
  photos={state.photos}
  layout={state.layout}
  gapColor={state.settings.gapColor}
  gap={state.settings.gapSize}  // NEW
  onSwapPhotos={handleSwapPhotos}
  onCellClick={setEditingPhotoId}
  onToggleHero={handleToggleHero}
/>
```

---

## Summary

| File | Change |
|------|--------|
| `CollagePreview.tsx` line 118 | Add `gap: number` to props interface |
| `CollagePreview.tsx` line 129 | Destructure `gap` from props |
| `CollagePreview.tsx` lines 217-221 | Compute padded dimensions for aspect ratio |
| `CollagePreview.tsx` lines 233-238 | Add `padding: gap` and use padded aspect ratio |
| `Index.tsx` line 523 | Pass `gap={state.settings.gapSize}` |

This is a presentation-layer-only fix - no changes to the layout algorithm needed.

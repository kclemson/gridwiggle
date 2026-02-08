

# Natural Aspect Ratio Thumbnails with Per-Photo Smart Crop

## Problem Summary

Currently, the ThumbnailNavigator shows photos in a forced **square grid** (using `aspect-square`), which:
1. Clips landscape/portrait photos and doesn't represent what's actually in them
2. On mobile where smart crop is disabled by default, users see distorted previews that don't match the actual photo content

Additionally, users have no way to selectively apply smart crop to individual photos - it's all-or-nothing.

---

## Design Intent

**What behavior do we want?**
- Thumbnails show photos with their **natural aspect ratios** (or cropped aspect ratio if already cropped)
- Each photo has an "Auto-crop" action button to trigger smart cropping for that specific photo
- Photos that have been smart-cropped show an "Undo" button to revert to uncropped state
- The thumbnail updates immediately to reflect the new crop state

**What will users experience?**
- Gallery view that accurately represents each photo's shape
- Ability to selectively smart-crop specific photos (especially useful on mobile)
- Visual feedback showing which photos are cropped vs full-frame
- Easy way to undo unwanted smart crops

---

## Technical Analysis

### Current Layout Issue

The ThumbnailNavigator uses:
```tsx
<button className="relative aspect-square">
```

This forces all thumbnails into squares, clipping content.

### Solution: Row-based Flex Layout

Instead of a grid with forced squares, use a **flex row layout with consistent height** (similar to PhotoGrid and PhotoStrip):

```tsx
// Fixed height, natural width based on aspect ratio
style={{ height: THUMBNAIL_HEIGHT, width: calculated from aspect ratio }}
```

This matches the pattern already established in PhotoThumbnail (lines 31-35):
```tsx
const aspectRatio = activeCrop 
  ? activeCrop.width / activeCrop.height 
  : photo.originalWidth / photo.originalHeight;

const width = Math.round(height * aspectRatio);
```

### Per-Photo Smart Crop Actions

Need two new callbacks on ThumbnailNavigatorProps:
- `onSmartCrop(photoId: string)` - trigger AI smart crop
- `onUndoSmartCrop(photoId: string)` - clear the smart crop

And state tracking for which photo is currently being processed:
- `smartCroppingPhotoId` - passed from parent

---

## Implementation Details

### ThumbnailNavigator Props (New)

| Prop | Type | Purpose |
|------|------|---------|
| `onSmartCrop` | `(photoId: string) => void` | Trigger smart crop for a photo |
| `onUndoSmartCrop` | `(photoId: string) => void` | Clear smart crop from a photo |
| `smartCroppingPhotoId` | `string \| null` | Currently processing (shows spinner) |

### Layout Changes

**Before:** Grid with square cells
```tsx
<div 
  className="grid gap-3"
  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${THUMBNAIL_SIZE}px, 1fr))` }}
>
  <button className="relative aspect-square" ...>
```

**After:** Flex wrap with natural aspect ratios
```tsx
<div className="flex flex-wrap gap-3 justify-center">
  <div 
    className="flex flex-col items-center gap-1"
    style={{ width: calculatedWidth }}
  >
    <button style={{ height: THUMBNAIL_HEIGHT, width: calculatedWidth }}>
      {/* Photo thumbnail */}
    </button>
    {/* Action button below */}
    <Button size="sm" variant="ghost" onClick={...}>
      {hasSmartCrop ? 'Undo' : 'Auto-crop'}
    </Button>
  </div>
```

### Thumbnail Item Structure

Each thumbnail becomes a vertical stack:
```
┌─────────────┐
│             │
│   [photo]   │ ← natural aspect ratio
│             │
├─────────────┤
│ [Auto-crop] │ ← or "Undo" if already cropped
│  or [Undo]  │
└─────────────┘
```

### Action Button States

| State | Button Text | Icon | Action |
|-------|------------|------|--------|
| No crop | "Auto-crop" | Wand2 | Call onSmartCrop |
| Has smart crop | "Undo" | Undo2 | Call onUndoSmartCrop |
| Currently processing | Spinner + "Cropping..." | Loader2 | Disabled |

### Index.tsx Integration

Pass the existing `handleSingleSmartCrop` and add new `handleUndoSmartCrop`:

```tsx
const handleUndoSmartCrop = useCallback((photoId: string) => {
  updatePhoto(photoId, { smartCrop: null });
  if (state.layout) {
    regenerateCollage();
  }
}, [updatePhoto, state.layout, regenerateCollage]);

// In render:
<ThumbnailNavigator
  photos={state.photos}
  currentIndex={0}
  onSelect={(photoId) => {
    setEditingPhotoId(photoId);
    setNavigatorOpen(false);
  }}
  onClose={() => setNavigatorOpen(false)}
  onSmartCrop={handleSingleSmartCrop}
  onUndoSmartCrop={handleUndoSmartCrop}
  smartCroppingPhotoId={smartCroppingPhotoId}
/>
```

---

## Visual Comparison

**Before (square grid, no per-photo actions):**
```
┌──────────────────────────────┐
│ Select Photo                 │
├──────────────────────────────┤
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐    │
│ │🔳│ │🔳│ │🔳│ │🔳│ │🔳│    │  ← forced squares
│ └──┘ └──┘ └──┘ └──┘ └──┘    │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐         │
│ │🔳│ │🔳│ │🔳│ │🔳│         │
│ └──┘ └──┘ └──┘ └──┘         │
└──────────────────────────────┘
```

**After (natural aspect ratios with actions):**
```
┌──────────────────────────────────────────┐
│ Select Photo                             │
├──────────────────────────────────────────┤
│  ┌─────┐   ┌──┐  ┌────────┐  ┌───┐      │
│  │     │   │  │  │        │  │   │      │  ← natural shapes
│  │     │   │  │  └────────┘  │   │      │
│  └─────┘   └──┘  [Auto-crop] └───┘      │
│ [Auto-crop][✓Undo]          [Auto-crop] │
│                                          │
│  ┌──────┐  ┌───┐  ┌──┐  ┌─────────┐     │
│  │      │  │   │  │  │  │         │     │
│  └──────┘  └───┘  │  │  └─────────┘     │
│ [Auto-crop] [✓]   └──┘  [Cropping...]   │
└──────────────────────────────────────────┘
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/components/ThumbnailNavigator.tsx` | Change to flex layout with natural aspect ratios; add per-photo action buttons |
| `src/pages/Index.tsx` | Add `handleUndoSmartCrop` callback; pass new props to ThumbnailNavigator |

---

## Implementation Notes

1. **Height constant**: Keep `THUMBNAIL_HEIGHT = 85` (or similar) for consistent row heights
2. **Width calculation**: `width = height * aspectRatio` where aspectRatio comes from crop or original dimensions
3. **Minimum width**: Clamp to prevent extremely narrow thumbnails (e.g., `minWidth: 50`)
4. **Button styling**: Use `variant="ghost"` and `size="sm"` to keep buttons subtle
5. **Cropped indicator**: Keep the existing crop icon badge in the corner to show at-a-glance status


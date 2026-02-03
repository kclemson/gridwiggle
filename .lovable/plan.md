

## Add Photo Counts and Refined Hint Styling (with Italics)

### Current State
```
ORIGINAL PHOTOS
SMART CROPPED (TAP TO ADJUST)
```

### Proposed Layout
```
ORIGINAL PHOTOS (3)
SMART CROPPED (2) — tap to adjust
                    ↑ italic + normal case
```

### Changes

**File: `src/components/PhotoGrid.tsx`**

1. **Add `hint` prop** (optional string)
2. **Auto-include count** from `photos.length` in the header
3. **Style hint** with `normal-case font-normal italic` for a softer, helpful appearance

```tsx
interface PhotoGridProps {
  photos: PhotoItem[];
  onRemove: (photoId: string) => void;
  onPhotoClick?: (photoId: string) => void;
  showCropped?: boolean;
  title: string;
  hint?: string;  // NEW
  emptyMessage?: string;
}

// In render:
<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
  {title} ({photos.length})
  {hint && (
    <span className="normal-case font-normal italic ml-1">— {hint}</span>
  )}
</h3>
```

**File: `src/pages/Index.tsx`**

Update PhotoGrid calls:

```tsx
{/* Original photos grid */}
<PhotoGrid
  photos={state.photos}
  onRemove={handleRemovePhoto}
  title="Original Photos"
/>

{/* Smart cropped photos grid */}
<PhotoGrid
  photos={photosWithSmartCrop}
  onRemove={handleRemovePhoto}
  onPhotoClick={setEditingPhotoId}
  showCropped
  title="Smart Cropped"
  hint="tap to adjust"
/>
```

### Visual Result

```
ORIGINAL PHOTOS (3)
SMART CROPPED (2) — tap to adjust
```

The italic styling makes the hint feel like a gentle suggestion rather than part of the formal header.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/PhotoGrid.tsx` | Add `hint` prop, include count, style hint as italic + normal case |
| `src/pages/Index.tsx` | Update PhotoGrid calls with new prop structure |


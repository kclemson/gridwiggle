

# Update Photo Grid Header with Smart Crop Count

## Overview

Add a smart crop count to the photos grid header, showing how many photos have been auto-cropped by the AI face/subject detection.

## Current vs New Header

| Current | New |
|---------|-----|
| `PHOTOS (10) (tap to adjust crop)` | `PHOTOS (10, 7 smartcropped) (tap to adjust crop)` |

## Implementation

### File: `src/components/PhotoGrid.tsx`

**Add a computed count** using `useMemo`:

```typescript
const smartCroppedCount = useMemo(() => {
  return photos.filter(p => p.smartCrop !== null).length;
}, [photos]);
```

**Update the header** to conditionally show the smart crop count:

```tsx
<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
  {title} ({photos.length}{smartCroppedCount > 0 && `, ${smartCroppedCount} smartcropped`})
  {hint && (
    <span className="normal-case font-normal italic ml-1">({hint})</span>
  )}
</h3>
```

## Behavior

- **10 photos, 7 smart cropped**: `PHOTOS (10, 7 smartcropped)`
- **10 photos, 0 smart cropped**: `PHOTOS (10)` (no suffix shown)
- **All 10 smart cropped**: `PHOTOS (10, 10 smartcropped)`

## Notes

- Only shows the smart crop count when at least 1 photo has a smart crop
- The count updates reactively as photos are processed or removed
- No props changes needed - `PhotoGrid` already has access to the full `PhotoItem[]`


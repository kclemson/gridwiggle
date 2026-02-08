
# Remove Selection Outline from View All Grid

## Problem Summary

The "View All" grid shows a white+purple ring on photo #1 (from `currentIndex: 0`). This visual was designed for a carousel navigation context, but the grid is now just a gallery for browsing/editing — there's no "currently selected photo" concept anymore.

---

## Confirmation: Using 480px Thumbnails

Yes, we ARE using the smaller thumbnails:

1. **CroppedImage** (line 35): `thumbnailSrc ?? previewSrc ?? src` — prioritizes smallest
2. **ThumbnailNavigator** passes `thumbnailSrc={photo.thumbnailUrl}` (line 151)
3. **Fallback img** (line 159): `photo.thumbnailUrl ?? photo.previewUrl ?? photo.objectUrl`

The 480px thumbnails are correctly used. The 1200px previewUrl is only used if thumbnailUrl is unavailable.

---

## Implementation Details

### File: `src/components/ThumbnailNavigator.tsx`

**Change 1: Remove unused `currentIndex` prop (line 13 and 27)**

The prop is no longer needed since there's no "selected" concept.

```tsx
// Before (line 13)
interface ThumbnailNavigatorProps {
  photos: PhotoItem[];
  currentIndex: number;  // Remove this line
  onSelect: ...

// After
interface ThumbnailNavigatorProps {
  photos: PhotoItem[];
  onSelect: ...
```

**Change 2: Remove `currentIndex` from destructuring (line 27)**

```tsx
// Before
export function ThumbnailNavigator({
  photos,
  currentIndex,
  onSelect,
  ...

// After
export function ThumbnailNavigator({
  photos,
  onSelect,
  ...
```

**Change 3: Remove `isSelected` variable and selection styling (lines 110, 137)**

```tsx
// Before (line 110)
const isSelected = index === currentIndex;

// Line 137
isSelected && isLoaded && "ring-2 ring-primary ring-offset-2"

// After - remove isSelected line entirely, and remove the selection styling
className={cn(
  "relative transition-all overflow-hidden rounded",
  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
  // No selection ring - keep focus ring for accessibility
)}
```

### File: `src/pages/Index.tsx`

**Change: Remove `currentIndex` prop from ThumbnailNavigator call (line 818)**

```tsx
// Before
<ThumbnailNavigator
  photos={state.photos}
  currentIndex={0}  // Remove this line
  onSelect={...}

// After
<ThumbnailNavigator
  photos={state.photos}
  onSelect={...}
```

---

## Visual Comparison

**Before:**
```
[Photo 1]  ← purple ring (selected)
[Photo 2]
[Photo 3]
```

**After:**
```
[Photo 1]  ← no ring
[Photo 2]
[Photo 3]
(focus ring still appears on keyboard navigation)
```

---

## File Changes Summary

| File | Location | Change |
|------|----------|--------|
| ThumbnailNavigator.tsx | Line 13 | Remove `currentIndex` from interface |
| ThumbnailNavigator.tsx | Line 27 | Remove from destructuring |
| ThumbnailNavigator.tsx | Line 110 | Remove `isSelected` variable |
| ThumbnailNavigator.tsx | Line 137 | Remove selection ring styling |
| Index.tsx | Line 818 | Remove `currentIndex={0}` prop |

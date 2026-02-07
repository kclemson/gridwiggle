
# Fix Thumbnail Grid Size & Selection Ring Clipping

## What You'll Experience After This Fix

1. **Larger thumbnails in View All**: Photos will be 85px instead of 56px - easier to see and select
2. **Mobile-friendly layout**: Grid will adapt gracefully to smaller screens (fewer columns, appropriate padding)
3. **Selection ring visible**: The purple border around the current photo won't be cut off anymore

---

## Technical Changes

### File: `src/components/ThumbnailNavigator.tsx`

**Change 1: Increase thumbnail size**
```typescript
// Line 19: Change from 56 to 85
const THUMBNAIL_SIZE = 85; // px
```

**Change 2: Fix ring clipping issue**

The problem is that `overflow-hidden` on the button clips the `ring` and `ring-offset` which render *outside* the element bounds. The fix is to:
- Remove `overflow-hidden` from the button (which was there to clip the image)
- Instead, add `overflow-hidden` and `rounded` to the image container inside

```typescript
// Line 116-124: Update button and image wrapper
<button
  key={photo.id}
  onClick={() => handleSelect(photo.id)}
  className={cn(
    "relative aspect-square transition-all",
    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
    isSelected && isLoaded && "ring-2 ring-primary ring-offset-2"
  )}
  style={{ 
    minHeight: THUMBNAIL_SIZE,
    minWidth: THUMBNAIL_SIZE,
  }}
>
  {isLoaded ? (
    <div className="w-full h-full rounded overflow-hidden">
      {crop ? (
        <CroppedImage ... />
      ) : (
        <img ... />
      )}
    </div>
    ...
  )}
</button>
```

**Change 3: Better mobile responsiveness**

Add responsive padding and ensure grid works on narrow viewports:
```typescript
// Line 99-104: Update grid container
<div 
  className="grid gap-3"
  style={{
    gridTemplateColumns: `repeat(auto-fill, minmax(${THUMBNAIL_SIZE}px, 1fr))`,
  }}
>
```

Also update the container max-width to be responsive:
```typescript
// Line 78: Make container more responsive
<div className="flex flex-col w-full max-w-lg sm:max-w-xl md:max-w-2xl">
```

---

## Summary of Changes

| Location | Change |
|----------|--------|
| Line 19 | `THUMBNAIL_SIZE = 85` (was 56) |
| Line 78 | Add responsive max-width classes |
| Line 101 | Increase gap from `gap-2` to `gap-3` |
| Line 117 | Remove `rounded overflow-hidden` from button |
| Line 127-142 | Wrap image content in `<div className="w-full h-full rounded overflow-hidden">` |


# Move "Add Photos" Button to Header

## Current Layout

```
┌─────────────────────────────────────────┐
│  gridwiggle                 [Clear All] │  ← header
├─────────────────────────────────────────┤
│         [+ Add More Photos]             │  ← standalone row
│  PHOTOS (44) · 38 auto-cropped      ▼  │
│  ...                                    │
└─────────────────────────────────────────┘
```

## Proposed Layout

```
┌─────────────────────────────────────────┐
│  gridwiggle    [+ Add Photos] [Clear All] │  ← header with both buttons
├─────────────────────────────────────────┤
│  PHOTOS (44) · 38 auto-cropped      ▼  │
│  ...                                    │
└─────────────────────────────────────────┘
```

---

## Technical Changes

### 1. File: `src/components/PhotoUploader.tsx`

**Lines 65-72**: Update the button text from "Add More Photos" to "Add Photos"

```tsx
<Button
  onClick={handleClick}
  variant="outline"
  className="touch-target gap-2"
>
  <Plus className="h-5 w-5" />
  Add Photos
</Button>
```

### 2. File: `src/pages/Index.tsx`

**Lines 394-404**: Add the PhotoUploader next to Clear All in the header

```tsx
{state.photos.length > 0 && (
  <div className="flex items-center gap-2">
    <PhotoUploader 
      onPhotosAdded={handlePhotosAdded}
      hasPhotos={true}
    />
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={clearAll}
    >
      <Trash2 className="h-4 w-4 mr-1" />
      Clear All
    </Button>
  </div>
)}
```

**Lines 420-426**: Remove the standalone "Add more photos" row

Delete:
```tsx
{/* Add more photos button */}
<div className="flex justify-center">
  <PhotoUploader 
    onPhotosAdded={handlePhotosAdded}
    hasPhotos={true}
  />
</div>
```

### 3. File: `src/components/PhotoUploader.tsx`

**Lines 65-72**: Adjust button sizing to match header style

```tsx
<Button
  onClick={handleClick}
  variant="outline"
  size="sm"
  className="gap-1.5"
>
  <Plus className="h-4 w-4" />
  Add Photos
</Button>
```

Using `size="sm"` and smaller icon (`h-4 w-4`) to match the header's compact style.

---

## Result

The header will now contain both action buttons side by side, saving vertical space and keeping all controls in one place. The button text is shortened from "Add More Photos" to "Add Photos" for a cleaner look.

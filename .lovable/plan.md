

# Revised Architecture Plan with Proper useEffect Usage

This plan addresses both the architectural consolidation AND corrects useEffect anti-patterns based on the project guidelines.

---

## useEffect Audit

### Current useEffect Usages

| Location | Purpose | Verdict |
|----------|---------|---------|
| `Index.tsx:43-84` | Process smart crops when photos added | **VIOLATION** - Should be triggered in event handler |
| `useCollageState.ts:51-53` | Persist to localStorage on state change | **VIOLATION** - Should persist in setter functions |
| `CollagePreview.tsx:27-42` | Window resize listener | **APPROPRIATE** - Browser API subscription |
| `CropEditor.tsx:24-40` | Init crop from photo prop when dialog opens | **VIOLATION** - Should use conditional rendering |
| `CropEditor.tsx:43-68` | Window resize listener | **APPROPRIATE** - Browser API subscription |

### Fixes

**1. Smart crop processing** - Move to event handler in `handlePhotosAdded`:
```text
// Instead of useEffect watching state.photos:
const handlePhotosAdded = async (newPhotos: PhotoItem[]) => {
  addPhotos(newPhotos);
  // Process immediately after adding
  for (const photo of newPhotos) {
    processSmartCrop(photo); // handles its own state updates
  }
};
```

**2. localStorage persistence** - Move into the setter callbacks:
```text
// Instead of useEffect watching state:
const addPhotos = useCallback((newPhotos) => {
  setState((prev) => {
    const next = { ...prev, photos: [...prev.photos, ...newPhotos] };
    saveToStorage(next); // Persist in same callback
    return next;
  });
}, []);
```

**3. CropEditor initialization** - Use conditional rendering:
```text
// Instead of always rendering with useEffect sync:
{editingPhotoId && (
  <CropEditor
    photo={photos.find(p => p.id === editingPhotoId)!}
    onClose={() => setEditingPhotoId(null)}
    onSave={handleSaveCrop}
  />
)}
// Component unmounts on close, useState naturally resets
```

---

## Component Architecture

### New Shared Components

**`src/components/common/CroppedImage.tsx`**

Single source of truth for rendering any image with optional crop:

```text
Props:
- src: string (image data URL)
- crop: CropRegion | null
- originalWidth: number
- originalHeight: number
- fit: 'contain' | 'cover' (how to fit within container)
- className?: string

Rendering logic:
- If no crop: render with object-contain or object-cover
- If crop: use CSS transform to scale and translate
```

Used by: `PhotoThumbnail`, `CollagePreview`, `CropEditor`

**`src/components/common/ImageContainer.tsx`**

Flexible container with consistent sizing:

```text
Props:
- aspectRatio: 'square' | 'original' | number
- className?: string
- children: React.ReactNode
```

---

## Hook Refactoring

### `useCollageState.ts` - Remove localStorage useEffect

```text
Before:
  useEffect(() => saveToStorage(state), [state]);

After:
  // Each setter function persists immediately:
  const addPhotos = useCallback((newPhotos) => {
    setState((prev) => {
      const next = {...};
      saveToStorage(next);
      return next;
    });
  }, []);
```

Benefits:
- No sync effect watching state
- Persistence is explicit side effect of user action
- Easier to reason about when saves happen

### `useSmartCropProcessor.ts` - Processing via callbacks, not effects

```text
// Returns a function to process photos, not a hook with effects
function createSmartCropProcessor(updatePhoto: Function) {
  return async (photos: PhotoItem[], onProgress?: (pct: number) => void) => {
    let completed = 0;
    for (const photo of photos) {
      // ... process each photo
      completed++;
      onProgress?.(completed / photos.length * 100);
    }
  };
}
```

Called from `handlePhotosAdded` event handler, not from a useEffect.

---

## CropEditor Refactoring

### Problem
Current code uses useEffect to initialize `crop` state from `photo` prop:
```text
useEffect(() => {
  if (photo && isOpen) {
    setCrop(photo.manualCrop || photo.smartCrop || defaultCrop);
  }
}, [photo, isOpen]);
```

This is state synchronization between props and local state - exactly what the guidelines say NOT to do.

### Solution
Use conditional rendering so component unmounts on close:

```text
// In Index.tsx:
{editingPhotoId && (
  <CropEditor
    photo={photos.find(p => p.id === editingPhotoId)!}
    ...
  />
)}

// In CropEditor.tsx:
// Remove isOpen prop entirely - component only renders when open
// Initialize crop directly from props:
const initialCrop = photo.manualCrop || photo.smartCrop || defaultCrop;
const [crop, setCrop] = useState(initialCrop);
// No useEffect needed - useState initializer runs once on mount
```

---

## File Changes Summary

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/common/CroppedImage.tsx` | Unified crop rendering |
| `src/components/common/ImageContainer.tsx` | Flexible container |
| `src/components/layout/AppHeader.tsx` | Extracted header |

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCollageState.ts` | Remove useEffect, persist in setters |
| `src/pages/Index.tsx` | Move smart crop processing to event handler, use conditional rendering for CropEditor |
| `src/components/PhotoThumbnail.tsx` | Use CroppedImage component |
| `src/components/CollagePreview.tsx` | Use CroppedImage component |
| `src/components/CropEditor.tsx` | Remove isOpen/useEffect pattern, use useState initializer |

### Folder Reorganization

```text
src/components/collage/     # Feature components
src/components/common/      # Shared primitives
src/components/layout/      # Layout components
```

---

## Implementation Order

1. Fix `useCollageState.ts` - remove localStorage useEffect
2. Create `CroppedImage` and `ImageContainer` components
3. Refactor `CropEditor` - conditional rendering pattern
4. Update `PhotoThumbnail` to use `CroppedImage`
5. Update `CollagePreview` to use `CroppedImage`
6. Move smart crop processing to event handler in `Index.tsx`
7. Extract `AppHeader` component
8. Reorganize folder structure


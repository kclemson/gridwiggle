

# Migrate Photo Storage to IndexedDB (Simplified)

## Overview

Move photo image data from localStorage to IndexedDB. Photos never leave the browser - this is 100% client-side storage.

**Simplified scope**: No migration logic for existing localStorage data. Fresh start.

---

## Architecture

```text
User selects files
       │
       ▼
PhotoUploader (File → Blob + dimensions)
       │
       ├──► IndexedDB: { id, blob, width, height }
       │
       └──► localStorage: { id, width, height, smartCrop, manualCrop, ... }
                          + settings, layout
       │
       ▼
useCollageState hydrates on load
       │
       ▼
PhotoItem { id, objectUrl, blob, ... } (in-memory)
```

**Key point**: Zero server round-trips for photos. All storage and processing happens in the browser.

---

## Implementation Steps

### Step 1: Create IndexedDB Storage Module

**New file**: `src/lib/photoStorage.ts`

```typescript
const DB_NAME = 'smart-collage';  // Easy to rename later
const DB_VERSION = 1;
const PHOTOS_STORE = 'photos';

interface StoredPhoto {
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

export async function initPhotoStorage(): Promise<IDBDatabase>
export async function savePhoto(photo: StoredPhoto): Promise<void>
export async function getPhoto(id: string): Promise<StoredPhoto | undefined>
export async function getAllPhotos(): Promise<StoredPhoto[]>
export async function deletePhoto(id: string): Promise<void>
export async function clearAllPhotos(): Promise<void>
```

---

### Step 2: Update Types

**File**: `src/types/collage.ts`

```typescript
// Runtime state (in-memory)
export interface PhotoItem {
  id: string;
  objectUrl: string;          // For <img src> rendering
  blob: Blob;                 // For canvas operations
  originalWidth: number;
  originalHeight: number;
  smartCrop: CropRegion | null;
  manualCrop: CropRegion | null;
  isProcessing: boolean;
  error: string | null;
}

// What gets saved to localStorage (no image data)
export interface PhotoMetadata {
  id: string;
  originalWidth: number;
  originalHeight: number;
  smartCrop: CropRegion | null;
  manualCrop: CropRegion | null;
}
```

---

### Step 3: Update useCollageState Hook

**File**: `src/hooks/useCollageState.ts`

**Changes**:
- Add `isLoading` state for async initialization
- On mount: load metadata from localStorage, load blobs from IndexedDB, create Object URLs, merge into PhotoItem[]
- `addPhotos`: save blob to IndexedDB, save metadata to localStorage
- `removePhoto`: revoke Object URL, delete from IndexedDB, remove from localStorage
- `clearAll`: revoke all URLs, clear IndexedDB, clear localStorage
- Add cleanup effect to revoke Object URLs on unmount

**localStorage now stores**:
```typescript
{
  photos: PhotoMetadata[],  // No image data
  settings: CollageSettings,
  layout: CollageLayout | null
}
```

---

### Step 4: Update PhotoUploader

**File**: `src/components/PhotoUploader.tsx`

**Before**:
```typescript
const dataUrl = await fileToDataUrl(file);
```

**After**:
```typescript
const blob = file;  // File is already a Blob
const objectUrl = URL.createObjectURL(blob);
const dimensions = await getImageDimensions(objectUrl);

return {
  id: generateId(),
  objectUrl,
  blob,
  originalWidth: dimensions.width,
  originalHeight: dimensions.height,
  // ...
};
```

---

### Step 5: Update Image Consumers

Replace `originalDataUrl` with `objectUrl` for rendering:

| File | Change |
|------|--------|
| `CropEditor.tsx` | `photo.originalDataUrl` → `photo.objectUrl` |
| `CroppedImage.tsx` | Already uses `src` prop, no change needed |
| `PhotoThumbnail.tsx` | Passes correct prop, no change needed |

For canvas operations, use `blob`:

| File | Change |
|------|--------|
| `exportCollage.ts` | Create Image from `URL.createObjectURL(photo.blob)` |
| `smartCropService.ts` | Accept objectUrl or convert blob to dataUrl on demand |

---

### Step 6: Add Loading State

**File**: `src/pages/Index.tsx`

```typescript
const { state, isLoading, ... } = useCollageState();

if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
```

---

### Step 7: Update imageUtils

**File**: `src/lib/imageUtils.ts`

- Remove `fileToDataUrl` (no longer needed)
- Keep `getImageDimensions` (works with Object URLs)
- Add `blobToDataUrl` for smart crop service (needs base64 for edge function)

---

## Files Summary

| File | Action |
|------|--------|
| `src/lib/photoStorage.ts` | **CREATE** - IndexedDB wrapper |
| `src/types/collage.ts` | **MODIFY** - Update PhotoItem, add PhotoMetadata |
| `src/hooks/useCollageState.ts` | **MODIFY** - Async init, hybrid storage, URL cleanup |
| `src/components/PhotoUploader.tsx` | **MODIFY** - Use Blob instead of dataUrl |
| `src/components/CropEditor.tsx` | **MODIFY** - Use objectUrl |
| `src/lib/exportCollage.ts` | **MODIFY** - Load from blob |
| `src/services/smartCropService.ts` | **MODIFY** - Convert blob to dataUrl for edge function |
| `src/lib/imageUtils.ts` | **MODIFY** - Add blobToDataUrl, remove fileToDataUrl |
| `src/pages/Index.tsx` | **MODIFY** - Handle loading state |

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| IndexedDB unavailable | Show error toast, app works but photos won't persist |
| Blob missing for metadata | Remove orphaned metadata silently |
| Storage quota exceeded | Show user-friendly error suggesting to remove some photos |

---

## Memory Management

- **Object URLs**: Revoked when photo is removed or on component unmount
- **Blobs**: Held in memory during session for fast canvas access; garbage collected when photo removed from state

---

## Testing Checklist

1. Upload photos, refresh page - photos persist
2. Remove single photo - removed from both stores
3. Clear all - both stores cleared
4. Export collage - renders correctly
5. Smart crop - processes correctly
6. Crop editor - displays full image
7. 20+ photos - no quota errors
8. Private browsing - works but shows "photos won't persist" warning


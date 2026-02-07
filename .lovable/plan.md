
# Fix Upload Progress UI Delay

## Problem
After clicking "Tap to add photos" and selecting files, there's a 3+ second delay before any progress UI appears. During this time, the user sees nothing - the app appears frozen.

## Root Cause

The current flow is fully sequential and blocking:

```text
User selects files
    ↓
For EACH photo (before calling onPhotosAdded):
    → Load image to get dimensions
    → Create display preview (canvas scaling)
    ↓
Call onPhotosAdded(photos)
    ↓
For EACH photo (in addPhotos):
    → Save to IndexedDB (sequential await)
    ↓
setState (photos now visible)
    ↓
Progress UI finally renders
```

With 50 photos, the user waits several seconds before seeing anything. All the heavy work happens before state updates.

---

## Solution

Show progress UI **immediately** after file selection, then process in the background.

### Two-Phase Approach:

**Phase 1 - Instant feedback (sync)**
- Create minimal PhotoItem objects with just file references
- Mark them as `isProcessing: true`
- Add to state immediately (triggers progress UI)

**Phase 2 - Background processing (async)**
- Load dimensions + create previews
- Persist to IndexedDB
- Update each photo as it completes

---

## Technical Changes

### 1. File: `src/components/PhotoUploader.tsx`

Simplify `processFiles` to create minimal placeholder objects instantly:

```tsx
const processFiles = useCallback(async (files: FileList) => {
  // Create minimal photo objects IMMEDIATELY (no async work)
  const photos: PhotoItem[] = Array.from(files).map((file) => {
    const objectUrl = URL.createObjectURL(file);
    return {
      id: generateId(),
      filename: file.name,
      objectUrl,
      blob: file,
      originalWidth: 0,  // Will be populated during processing
      originalHeight: 0,
      smartCrop: null,
      manualCrop: null,
      isProcessing: true,
      error: null,
      priority: 3,
      previewUrl: objectUrl,  // Use original URL as temporary preview
      previewBlob: file,
    };
  });

  // Call parent immediately - progress UI shows right away
  onPhotosAdded(photos);
}, [onPhotosAdded]);
```

### 2. File: `src/hooks/useCollageState.ts`

Add photos to state immediately, then persist in background:

```tsx
const addPhotos = useCallback(async (newPhotos: PhotoItem[]): Promise<{ succeeded: PhotoItem[]; failed: PhotoItem[] }> => {
  // STEP 1: Add to state IMMEDIATELY (shows progress UI)
  setState((prev) => ({
    ...prev,
    photos: [...prev.photos, ...newPhotos],
  }));
  
  // Track URLs
  newPhotos.forEach(p => objectUrlsRef.current.add(p.objectUrl));

  // STEP 2: Persist to IndexedDB in background (non-blocking)
  const succeeded: PhotoItem[] = [];
  const failed: PhotoItem[] = [];

  for (const photo of newPhotos) {
    try {
      await savePhoto({
        id: photo.id,
        blob: photo.blob,
        width: photo.originalWidth,
        height: photo.originalHeight,
      });
      succeeded.push(photo);
    } catch (e) {
      console.error('Failed to save photo to IndexedDB:', photo.id, e);
      failed.push(photo);
      // Remove from state on failure
      setState((prev) => ({
        ...prev,
        photos: prev.photos.filter(p => p.id !== photo.id),
      }));
      URL.revokeObjectURL(photo.objectUrl);
    }
  }

  // Save metadata after all IndexedDB writes complete
  if (succeeded.length > 0) {
    debouncedSaveMetadata({
      ...state,
      photos: [...state.photos, ...succeeded],
    });
  }

  return { succeeded, failed };
}, [debouncedSaveMetadata, state]);
```

### 3. File: `src/pages/Index.tsx`

Move dimension loading and preview creation into the smart crop processing phase:

```tsx
const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
  // Add to state immediately (triggers progress UI)
  const { succeeded } = await addPhotos(newPhotos);
  
  if (succeeded.length === 0) return;

  const wasLayoutEmpty = state.layout === null;

  // Load dimensions + previews during smart crop phase
  // (dimensions needed for proper layout anyway)
  try {
    await processSmartCrops(succeeded);
  } catch (error) {
    console.error('Smart crop processing failed:', error);
  } finally {
    regenerateCollage({ randomize: !wasLayoutEmpty });
  }
}, [addPhotos, state.layout, processSmartCrops, regenerateCollage]);
```

### 4. File: `src/pages/Index.tsx` - Update `processSmartCrops`

Add dimension loading at the start of each photo's processing:

```tsx
const processSmartCrops = useCallback(async (photos: PhotoItem[]) => {
  if (photos.length === 0) return;
  
  setIsProcessingSmartCrop(true);
  setSmartCropProgress(0);
  
  let completed = 0;
  const total = photos.length;

  for (const photo of photos) {
    setCurrentlyProcessingId(photo.id);
    
    try {
      // Load dimensions if not yet known
      if (photo.originalWidth === 0 || photo.originalHeight === 0) {
        const dimensions = await getImageDimensions(photo.objectUrl);
        // Create display preview
        const preview = await createDisplayPreview(photo.blob, 1200);
        
        updatePhoto(photo.id, {
          originalWidth: dimensions.width,
          originalHeight: dimensions.height,
          previewUrl: preview.url,
          previewBlob: preview.blob,
        });
      }
      
      const result = await getSmartCrop(
        photo.objectUrl,
        photo.blob,
        photo.originalWidth || 1, // Use loaded dimensions
        photo.originalHeight || 1,
        (status) => setProcessingStatus(status)
      );
      
      const smartCropToApply = result.skipCrop ? null : result.crop;
      
      updatePhoto(photo.id, {
        smartCrop: smartCropToApply,
        isProcessing: false,
      });
    } catch (error) {
      console.error('Smart crop failed for photo:', photo.id, error);
      updatePhoto(photo.id, {
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to process',
      });
    }
    
    completed++;
    setSmartCropProgress((completed / total) * 100);
  }
  
  setCurrentlyProcessingId(null);
  setIsProcessingSmartCrop(false);
  setSmartCropProgress(0);
}, [updatePhoto]);
```

---

## Result

| Before | After |
|--------|-------|
| 3+ seconds of blank screen | Progress UI appears instantly |
| User thinks app is frozen | User sees "0 of X ready" immediately |
| All work happens before UI update | Work happens while UI shows progress |

The progress UI (header showing "Photos · 0 of X ready") will appear immediately after file selection, then the count will increment as each photo is processed.

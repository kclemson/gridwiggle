

## Revised Fix: Sequential Photo Add → Process Flow

### Architectural Change

Instead of firing `addPhotos` and `processSmartCrops` in parallel without waiting, we'll make them properly sequential with clear success/failure handling.

### New Flow

```text
User uploads photos
       │
       ▼
┌─────────────────────┐
│  addPhotos()        │ ← Returns which photos saved successfully
│  (await IndexedDB)  │
└─────────────────────┘
       │
       ▼ (only succeeded photos)
┌─────────────────────┐
│  processSmartCrops()│ ← AI processing on confirmed photos
│  (with try/catch)   │
└─────────────────────┘
```

### Implementation Details

**File 1: `src/hooks/useCollageState.ts`**

Modify `addPhotos` to return success/failure information:

```typescript
interface AddPhotosResult {
  succeeded: PhotoItem[];
  failed: PhotoItem[];
}

const addPhotos = useCallback(async (newPhotos: PhotoItem[]): Promise<AddPhotosResult> => {
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
      objectUrlsRef.current.add(photo.objectUrl);
    } catch (e) {
      console.error('Failed to save photo to IndexedDB:', photo.id, e);
      failed.push(photo);
      // Revoke the object URL since we won't use this photo
      URL.revokeObjectURL(photo.objectUrl);
    }
  }

  if (failed.length > 0) {
    toast.error(`Failed to save ${failed.length} photo(s). Storage may be full.`);
  }

  if (succeeded.length > 0) {
    setState((prev) => {
      const next = {
        ...prev,
        photos: [...prev.photos, ...succeeded],
      };
      saveMetadataToStorage(next);
      return next;
    });
  }

  return { succeeded, failed };
}, []);
```

**File 2: `src/pages/Index.tsx`**

Make `handlePhotosAdded` properly async and sequential:

```typescript
const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
  // Step 1: Wait for photos to be saved to storage
  const { succeeded } = await addPhotos(newPhotos);
  
  if (succeeded.length === 0) {
    // All photos failed to save - nothing to process
    return;
  }

  // Step 2: Only process photos that were successfully saved
  try {
    await processSmartCrops(succeeded);
  } catch (error) {
    console.error('Smart crop processing failed:', error);
    toast.error('AI processing failed. Please try again.');
  }

  if (state.layout) setLayoutStale(true);
}, [addPhotos, processSmartCrops, state.layout]);
```

**File 3: `src/components/PhotoUploader.tsx`**

Update to handle async callback (no changes needed - React handles async event handlers fine).

### Changes Summary

| File | Change |
|------|--------|
| `useCollageState.ts` | Return `{ succeeded, failed }` from `addPhotos`, only add succeeded photos to state |
| `Index.tsx` | Make `handlePhotosAdded` async, await `addPhotos`, only call `processSmartCrops` on succeeded |
| `Index.tsx` | Add try/catch around `processSmartCrops` with toast error |

### What This Fixes

1. **No more crashes**: Errors are caught at each step
2. **No orphaned photos**: Only successfully saved photos are processed
3. **Clear feedback**: User knows immediately if storage failed
4. **No recovery logic needed**: Sequential flow means no "detect and retry" complexity
5. **Predictable behavior**: One step completes before the next starts

### Removed Complexity

We do NOT need:
- Recovery `useEffect` to detect unprocessed photos
- Orphan detection logic
- Complex error state management

The sequential approach is simpler and more robust.




## Fix: Photo Persistence and Console Log Spam

### Problem Summary

Two issues reported:
1. **Photos disappear and don't reload after refresh** - Most likely a race condition or error during initialization
2. **Console log spam from getDisplayCrop** - Debug logging left in production code

---

## Root Cause Analysis

### Issue 1: Photos Not Persisting

After tracing through the code, the persistence architecture is correct:
- IndexedDB stores blobs (`photoStorage.ts`)
- localStorage stores metadata (`useCollageState.ts`)  
- On load, both are merged via `hydratePhotos()`

The likely cause is a **silent failure** during initialization that's being swallowed. The `initialize()` function catches errors but doesn't report them well:

```typescript
// Current: errors logged but page shows empty state
} catch (e) {
  console.error('Failed to load photos from IndexedDB:', e);
}
```

Also, if the `getAllPhotos()` call fails, `storedPhotos` is empty and ALL photos are skipped as "orphaned metadata".

### Issue 2: Console Spam

`getDisplayCrop()` logs on every call, and it's called by `PhotoThumbnail` for every photo on every render. With 18 photos showing in your logs, that's 18+ log entries per render cycle.

---

## Technical Changes

### 1. Remove Debug Logging (`src/lib/cropUtils.ts`)

Remove all console.log statements from the crop utility functions:

| Lines | Change |
|-------|--------|
| 46-53 | Delete console.log block from `getDisplayCrop()` |
| 82-86 | Delete console.log from `getEditorInitialCrop()` |

Also remove from CropEditor:
| File | Lines | Change |
|------|-------|--------|
| `src/components/CropEditor.tsx` | 26 | Delete console.log from useState initializer |

### 2. Improve Error Visibility (`src/hooks/useCollageState.ts`)

Add better error handling and reporting during initialization:

**Current:**
```typescript
let storedPhotos: StoredPhoto[] = [];
try {
  storedPhotos = await getAllPhotos();
} catch (e) {
  console.error('Failed to load photos from IndexedDB:', e);
}
```

**Proposed:**
```typescript
let storedPhotos: StoredPhoto[] = [];
try {
  storedPhotos = await getAllPhotos();
} catch (e) {
  console.error('Failed to load photos from IndexedDB:', e);
  toast.error('Failed to load saved photos. Storage may be corrupted.');
}

// Log hydration results for debugging (single line, not per-photo)
console.log('[useCollageState] Hydrated', {
  metadataCount: persisted.photos.length,
  blobCount: storedPhotos.length,
  hydratedCount: photos.length,
});
```

This adds:
- User-visible toast when loading fails
- Single summary log line for debugging (not per-photo spam)

### 3. Add Orphan Cleanup Visibility

When photos are skipped during hydration (blob missing or metadata missing), log a warning:

```typescript
function hydratePhotos(
  metadata: PhotoMetadata[],
  storedPhotos: StoredPhoto[]
): PhotoItem[] {
  const blobMap = new Map(storedPhotos.map((p) => [p.id, p]));
  const hydrated: PhotoItem[] = [];
  const orphanedIds: string[] = [];

  for (const meta of metadata) {
    const stored = blobMap.get(meta.id);
    if (stored) {
      hydrated.push({...});
    } else {
      orphanedIds.push(meta.id);
    }
  }

  if (orphanedIds.length > 0) {
    console.warn('[hydratePhotos] Orphaned metadata (no blobs):', orphanedIds);
  }

  return hydrated;
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/cropUtils.ts` | Remove debug console.log statements |
| `src/components/CropEditor.tsx` | Remove debug console.log from useState |
| `src/hooks/useCollageState.ts` | Add toast on load failure, add single summary log, add orphan warning |

---

## Expected Result

1. **No more console spam** - Logging removed from hot paths
2. **Visible error messages** - Toast notification if storage load fails
3. **Better debugging** - Single summary log on load, orphan warnings if data mismatched
4. **Same persistence behavior** - No changes to actual storage logic (which appears correct)

---

## Note on "UI Refresh to Empty State"

If the photos appear and then the UI resets to empty without a tab refresh, this could be caused by:
- Vite hot module replacement (HMR) during development when files change
- An uncaught exception causing React to unmount/remount

The proposed changes will make any such errors more visible. If the issue persists after these changes, we can add more specific error boundaries.



# Mobile Debugging Plan (No useEffect)

## The Problems

Based on logs and code analysis, there are three distinct issues on iOS Safari:

### 1. "0 of 6 ready" - Photos Missing Dimensions
Photos load to IndexedDB successfully but remain at "0 of 6 ready" because metadata has `originalWidth: 0, originalHeight: 0`. The "ready" count filters by `p.originalWidth > 0`, so these show as not ready.

**Why on Mobile**: iOS Safari's stricter memory limits cause page crashes or tab purging before dimensions are saved.

### 2. Carousel Clipping
In `PhotoCarousel.tsx`:
```typescript
const aspectRatio = crop 
  ? crop.width / crop.height 
  : photo.originalWidth / photo.originalHeight;
// When both are 0: 0 / 0 = NaN → 180 * NaN = NaN
```

### 3. Black Rectangle in Crop Editor
In `CropEditor.tsx`:
```typescript
viewBox={`0 0 ${photo.originalWidth} ${photo.originalHeight}`}
// When 0: viewBox="0 0 0 0" → invalid SVG → black
```

---

## Solution: Callback-Based Recovery (No useEffect)

Instead of a useEffect that watches `isLoading`, we use a **callback pattern**:

1. `useCollageState` accepts an optional `onNeedsRecovery` callback
2. During initialization, after hydration completes, the hook checks for photos needing recovery
3. If found, it calls `onNeedsRecovery(photosNeedingRecovery)` directly from the init function
4. Index.tsx passes `processSmartCrops` as that callback

This is event-driven, not sync-via-effect.

---

## Implementation

### Step 1: Add Callback Parameter to useCollageState

**File: `src/hooks/useCollageState.ts`**

```typescript
interface UseCollageStateOptions {
  /** Called directly from initialization when photos need dimension recovery */
  onNeedsRecovery?: (photos: PhotoItem[]) => void;
}

export function useCollageState(options: UseCollageStateOptions = {}) {
  const { onNeedsRecovery } = options;
  // ... existing code ...

  // Inside initialize():
  const photos = hydratePhotos(persisted.photos, storedPhotos);
  
  // Find photos needing dimension recovery
  const needsRecovery = photos.filter(p => p.originalWidth === 0 || p.originalHeight === 0);
  
  if (needsRecovery.length > 0) {
    remoteLogger.warn('recovery', 'Photos need dimension recovery', {
      count: needsRecovery.length,
      ids: needsRecovery.map(p => p.id),
    });
    
    // Mark them as processing (so UI shows spinner)
    needsRecovery.forEach(p => { p.isProcessing = true; });
    
    // Call callback directly from init (not via effect)
    onNeedsRecovery?.(needsRecovery);
  }
}
```

### Step 2: Pass Recovery Callback from Index.tsx

**File: `src/pages/Index.tsx`**

```typescript
// Move processSmartCrops definition before useCollageState call
// (or use a ref to avoid stale closure)
const processSmartCropsRef = useRef<((photos: PhotoItem[]) => Promise<void>) | null>(null);

const {
  state,
  isLoading,
  // ...
} = useCollageState({
  onNeedsRecovery: (photos) => {
    // Defer to next tick so the component has mounted
    queueMicrotask(() => {
      processSmartCropsRef.current?.(photos);
    });
  },
});

// Later, assign the ref
processSmartCropsRef.current = processSmartCrops;
```

### Step 3: Add Defensive Guards to UI Components

**File: `src/components/PhotoCarousel.tsx`**

```typescript
// Safe aspect ratio calculation
const aspectRatio = (crop && crop.width > 0 && crop.height > 0)
  ? crop.width / crop.height 
  : (photo.originalWidth > 0 && photo.originalHeight > 0)
    ? photo.originalWidth / photo.originalHeight
    : 1; // Safe fallback for broken state
```

**File: `src/components/CropEditor.tsx`**

```typescript
// Guard against 0 dimensions
if (photo.originalWidth === 0 || photo.originalHeight === 0) {
  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Image Loading...</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 4: Add previewUrl During Hydration

**File: `src/hooks/useCollageState.ts`**

```typescript
// In hydratePhotos(), set previewUrl to same as objectUrl initially
hydrated.push({
  objectUrl,
  previewUrl: objectUrl, // Fallback to full-res until recovery creates preview
  // ...
});
```

### Step 5: Add Vision Worker Logging

**File: `src/services/smartCropService.ts`**

```typescript
function getWorker(): Worker | null {
  if (!worker) {
    try {
      remoteLogger.info('vision', 'Creating worker', {
        moduleSupport: typeof Worker !== 'undefined',
      });
      
      worker = new Worker(
        new URL('../workers/visionWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      remoteLogger.info('vision', 'Worker created successfully', {});
    } catch (e) {
      remoteLogger.error('vision', 'Worker creation failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }
  return worker;
}
```

### Step 6: Add Phase Logging to Smart Crop Processing

**File: `src/pages/Index.tsx`**

In `processSmartCrops`:
```typescript
remoteLogger.info('smartcrop', 'Phase: loading dimensions', { photoId: photo.id });
// ... dimension loading ...

remoteLogger.info('smartcrop', 'Phase: creating previews', { 
  photoId: photo.id,
  width: dimensions.width,
  height: dimensions.height,
});
// ... preview creation ...

remoteLogger.info('smartcrop', 'Phase: running detection', { photoId: photo.id });
// ... smart crop ...

remoteLogger.info('smartcrop', 'Phase: complete', { photoId: photo.id });
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useCollageState.ts` | Add `onNeedsRecovery` callback option, call from init, add previewUrl hydration |
| `src/pages/Index.tsx` | Pass recovery callback to hook, add phase logging to processSmartCrops |
| `src/components/PhotoCarousel.tsx` | Add defensive NaN guard for aspect ratio |
| `src/components/CropEditor.tsx` | Add guard for 0 dimensions, show loading state |
| `src/services/smartCropService.ts` | Add worker initialization logging |

---

## Why This Works Better Than useEffect

1. **Event-driven, not sync-driven**: Recovery triggers directly from the initialization event, not from watching state
2. **No race conditions**: The callback fires exactly once, after hydration is complete
3. **Clear data flow**: Index.tsx explicitly opts into recovery behavior by passing the callback
4. **No stale closures**: Using `queueMicrotask` + ref pattern ensures `processSmartCrops` has latest dependencies

---

## Expected Outcome

After implementation:

- Photos with missing dimensions show as "processing" and auto-recover
- Carousel and crop editor don't break with NaN/0 values  
- Edge function logs show exactly which phase fails on iOS
- Vision worker crashes are logged for diagnosis

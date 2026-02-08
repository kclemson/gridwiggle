
# Disable Auto Smart Crop on Mobile + Add Manual Button

## What Changes for Users

### Current Behavior
- When you upload photos, **every photo** is automatically analyzed by the AI vision model
- On iOS Safari this often crashes mid-batch due to memory pressure

### New Mobile Behavior
1. Upload → Photos appear immediately, **no AI processing**
2. In the photo carousel, a new **"Smart Crop"** button appears per photo
3. Tap it → AI analyzes just that one photo → applies smart crop
4. You can still manually crop any photo via the Edit button

### Desktop Behavior
- Unchanged: auto smart crop still runs on upload

---

## Technical Implementation

### 1. Detect Mobile Platform

Create a utility to check if running on mobile (not just viewport width—actual device):

**New file: `src/lib/platform.ts`**

```typescript
/**
 * Detect if running on a mobile device (phone/tablet).
 * Uses User-Agent for reliable device detection.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  
  // Match phones and tablets
  return /android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(ua);
}
```

---

### 2. Skip Auto Smart Crop on Mobile Upload

**File: `src/pages/Index.tsx`**

Modify `handlePhotosAdded` to skip `processSmartCrops` on mobile:

```typescript
import { isMobileDevice } from '@/lib/platform';

const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
  const { succeeded } = await addPhotos(newPhotos);
  
  if (succeeded.length === 0) return;
  
  remoteLogger.info('upload', 'Photos added', { count: succeeded.length });
  const wasLayoutEmpty = state.layout === null;

  // MOBILE: Skip auto smart crop - user triggers manually
  // DESKTOP: Run auto smart crop on all photos
  if (!isMobileDevice()) {
    try {
      await processSmartCrops(succeeded);
    } catch (error) {
      console.error('Smart crop processing failed:', error);
    }
  } else {
    // Mobile: Just load dimensions + create previews (no AI)
    for (const photo of succeeded) {
      await loadDimensionsOnly(photo);
    }
  }
  
  regenerateCollage({ randomize: !wasLayoutEmpty });
}, [addPhotos, processSmartCrops, state.layout, regenerateCollage]);
```

Add a new helper that loads dimensions without calling the vision worker:

```typescript
// Load dimensions + previews WITHOUT smart crop (for mobile upload)
const loadDimensionsOnly = useCallback(async (photo: PhotoItem) => {
  try {
    const dimensions = await getImageDimensions(photo.objectUrl);
    const [preview, thumbnail] = await Promise.all([
      createDisplayPreview(photo.blob, 1200),
      createDisplayPreview(photo.blob, 480),
    ]);
    
    updatePhoto(photo.id, {
      originalWidth: dimensions.width,
      originalHeight: dimensions.height,
      previewUrl: preview.url,
      previewBlob: preview.blob,
      thumbnailUrl: thumbnail.url,
      thumbnailBlob: thumbnail.blob,
      isProcessing: false,  // Done immediately
    });
  } catch (error) {
    updatePhoto(photo.id, {
      isProcessing: false,
      error: error instanceof Error ? error.message : 'Failed to load',
    });
  }
}, [updatePhoto]);
```

---

### 3. Add "Smart Crop" Button to PhotoCarousel

**File: `src/components/PhotoCarousel.tsx`**

Add a new callback prop and button:

```typescript
import { Wand2 } from 'lucide-react';  // Add to imports

interface PhotoCarouselProps {
  // ... existing props
  onSmartCrop?: (photoId: string) => void;  // New
  isSmartCropping?: boolean;                 // New - shows loading on button
}

// In the action buttons section, add this button:
<Button
  variant="outline"
  size="sm"
  onClick={(e) => {
    e.stopPropagation();
    onSmartCrop?.(photo.id);
  }}
  disabled={isSmartCropping || photo.smartCrop !== null}
  className="gap-1.5"
  title={photo.smartCrop ? "Already smart cropped" : "Auto-detect subjects"}
>
  <Wand2 className={cn("h-4 w-4", isSmartCropping && "animate-pulse")} />
  {photo.smartCrop ? "Cropped" : "Smart Crop"}
</Button>
```

Button behavior:
- Shows "Cropped" (disabled) if smart crop already applied
- Shows spinner while processing
- On click → triggers single-photo smart crop

---

### 4. Handle Single Photo Smart Crop in Index

**File: `src/pages/Index.tsx`**

Add state and handler for single-photo cropping:

```typescript
const [smartCroppingPhotoId, setSmartCroppingPhotoId] = useState<string | null>(null);

// Process smart crop for a single photo (mobile manual trigger)
const handleSingleSmartCrop = useCallback(async (photoId: string) => {
  const photo = state.photos.find(p => p.id === photoId);
  if (!photo || photo.smartCrop) return;  // Already has crop
  
  setSmartCroppingPhotoId(photoId);
  
  try {
    const result = await getSmartCrop(
      photo.objectUrl,
      photo.blob,
      photo.originalWidth,
      photo.originalHeight,
      (status) => setProcessingStatus(status)
    );
    
    const smartCropToApply = result.skipCrop ? null : result.crop;
    
    updatePhoto(photoId, { smartCrop: smartCropToApply });
    
    // Regenerate layout with new crop
    if (state.layout) {
      regenerateCollage();
    }
  } catch (error) {
    console.error('Smart crop failed:', error);
    // Silent fail - photo still works
  } finally {
    setSmartCroppingPhotoId(null);
  }
}, [state.photos, state.layout, updatePhoto, regenerateCollage]);
```

Pass to PhotoCarousel:

```tsx
<PhotoCarousel
  photos={state.photos}
  // ... existing props
  onSmartCrop={handleSingleSmartCrop}
  isSmartCropping={smartCroppingPhotoId !== null}
/>
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/platform.ts` | **New** - `isMobileDevice()` utility |
| `src/pages/Index.tsx` | Skip auto smart crop on mobile, add `handleSingleSmartCrop`, add `loadDimensionsOnly` |
| `src/components/PhotoCarousel.tsx` | Add "Smart Crop" button with `onSmartCrop` prop |

---

## User Experience Flow

### Mobile Upload (4 photos)
1. Tap "Add Photos" → Select 4 images
2. Photos appear instantly (no waiting, no spinners)
3. Collage generates immediately with full-image crops
4. Swipe to photo 2 → Tap "Smart Crop" → AI finds the subject → Crop applied
5. Collage regenerates with better framing

### Desktop Upload (unchanged)
1. Drag photos → Progress spinner shows
2. All photos processed automatically
3. Collage appears with smart crops applied

---

## Why This Solves the Problem

| Issue | Solution |
|-------|----------|
| iOS crashes on batch AI inference | No batch inference on mobile—one photo at a time, user-triggered |
| Memory accumulation | Single inference → GC → next inference (if user wants) |
| Long wait times | Photos available immediately; smart crop is optional |
| Feature preserved | Users who want smart crop can still use it (just manually) |

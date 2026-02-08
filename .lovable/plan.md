

# UI Simplification: Replace Carousel with Photo Strip

## Problem Summary

The carousel navigation isn't useful for most users - they rarely swipe through individual photos. But the Photos section header provides value as a quick reference ("here are your photos") and entry point to "View All" for editing.

---

## Design Intent

**What behavior do we want?**
- During upload: Clear visual feedback showing which photo is processing, with a thumbnail centered above its dot
- After upload: Quick visual confirmation of all photos via a filmstrip, with simple access to editing
- Remove carousel complexity (embla, navigation arrows, per-photo action buttons)

**What will users experience?**
- During upload: Compact processing indicator with the active thumbnail floating above its dot
- After upload: A filmstrip-style preview of all photos (not interactive beyond View All)
- Single "View All" entry point to the editing interface

---

## State-Based UI

| State | Component | What Shows |
|-------|-----------|------------|
| Processing | `PhotoProgressDots` (updated) | Thumbnail centered above active dot |
| Complete | `PhotoStrip` (new) | Full-width horizontal strip + View All button |

---

## Implementation Details

### Phase 1: Update PhotoProgressDots

Add thumbnail rendering above the active dot using absolute positioning:

```text
                   [48px thumb]
                        ↓
● ● ● ● ● ● ● ◎ ○ ○ ○ ○ ○ ○
              ↑
         currently processing
```

**File: `src/components/PhotoProgressDots.tsx`**

Changes:
- Accept new prop: `currentPhoto: PhotoItem | null`
- Each dot wrapped in `relative` container
- Active dot renders thumbnail with `absolute bottom-full left-1/2 -translate-x-1/2`
- Thumbnail size: 48x48px with rounded corners

```typescript
interface PhotoProgressDotsProps {
  photos: PhotoItem[];
  currentlyProcessingId: string | null;
  currentPhoto?: PhotoItem | null;  // NEW - for thumbnail
  className?: string;
}

export function PhotoProgressDots({
  photos,
  currentlyProcessingId,
  currentPhoto,
  className,
}: PhotoProgressDotsProps) {
  return (
    <div className={cn("flex gap-1 flex-wrap justify-center", className)}>
      {photos.map((photo) => {
        const isProcessing = photo.id === currentlyProcessingId;
        const isComplete = !photo.isProcessing && !photo.error;
        const hasError = !!photo.error;
        
        return (
          <div key={photo.id} className="relative">
            {/* Thumbnail floating above active dot */}
            {isProcessing && currentPhoto && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shadow-sm">
                  <img
                    src={currentPhoto.objectUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            
            {/* The dot */}
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                isProcessing && "bg-primary animate-pulse",
                isComplete && "bg-emerald-500",
                hasError && "bg-destructive",
                !isProcessing && !isComplete && !hasError && "bg-muted-foreground/30"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
```

### Phase 2: Update PhotoProcessingView

Remove the standalone thumbnail section, just use dots with integrated thumbnail:

**File: `src/components/PhotoProcessingView.tsx`**

Changes:
- Remove the 128x128 thumbnail section entirely
- Pass `currentPhoto` to `PhotoProgressDots`
- Add top padding (`pt-16`) to container for thumbnail overflow space

```typescript
export function PhotoProcessingView({
  photos,
  currentlyProcessingId,
}: PhotoProcessingViewProps) {
  const stats = useMemo(() => {
    const completed = photos.filter(p => !p.isProcessing && !p.error).length;
    const errors = photos.filter(p => p.error).length;
    return { completed, errors, total: photos.length };
  }, [photos]);

  const currentPhoto = currentlyProcessingId 
    ? photos.find(p => p.id === currentlyProcessingId) 
    : null;

  return (
    <div className="space-y-4 pt-16"> {/* padding for floating thumbnail */}
      {/* Error count only */}
      {stats.errors > 0 && (
        <div className="flex justify-center text-sm">
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{stats.errors} failed</span>
          </div>
        </div>
      )}

      {/* Processing dots with integrated thumbnail */}
      <div className="flex justify-center">
        <PhotoProgressDots 
          photos={photos}
          currentlyProcessingId={currentlyProcessingId}
          currentPhoto={currentPhoto}
          className="max-w-xs justify-center"
        />
      </div>
    </div>
  );
}
```

### Phase 3: Create PhotoStrip Component

New component showing all photos in a filmstrip after processing completes:

**File: `src/components/PhotoStrip.tsx`**

```typescript
import { PhotoItem } from '@/types/collage';
import { Button } from '@/components/ui/button';
import { Grid3X3 } from 'lucide-react';

interface PhotoStripProps {
  photos: PhotoItem[];
  autoCroppedCount: number;
  onViewAll: () => void;
}

export function PhotoStrip({
  photos,
  autoCroppedCount,
  onViewAll,
}: PhotoStripProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Photos ({photos.length})
        {autoCroppedCount > 0 && (
          <>
            <span className="mx-2 text-muted-foreground/50 normal-case">·</span>
            <span className="text-primary/80 normal-case font-normal tracking-normal">
              {autoCroppedCount} auto-cropped
            </span>
          </>
        )}
      </h3>

      {/* Photo strip - overflow hidden, not scrollable */}
      <div className="h-14 overflow-hidden rounded-lg bg-muted/30">
        <div className="flex h-full gap-0.5">
          {photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.thumbnailUrl ?? photo.previewUrl ?? photo.objectUrl}
              alt=""
              className="h-full w-auto flex-shrink-0 object-cover"
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={onViewAll}>
          <Grid3X3 className="h-4 w-4 mr-1.5" />
          View All
        </Button>
      </div>
    </div>
  );
}
```

### Phase 4: Update Index.tsx

Replace Collapsible + Carousel with conditional rendering:

**File: `src/pages/Index.tsx`**

**Remove:**
- `PhotoCarousel` import
- `carouselIndex` state
- `carouselOpen` state and `handleCarouselOpenChange`
- localStorage persistence for carousel state
- `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` usage in photos section
- `ChevronDown` icon (no longer needed for collapse toggle)

**Add:**
- `PhotoStrip` import
- Conditional rendering: `isProcessing ? <PhotoProcessingView /> : <PhotoStrip />`

**Changes in the photos section (lines ~664-737):**

```typescript
{/* Photo section - no longer collapsible */}
{isProcessing ? (
  // Processing: show header + dots with floating thumbnail
  <div className="space-y-3">
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
      Photos
      <span className="mx-2 text-muted-foreground/50">·</span>
      <Loader2 className="inline h-3 w-3 animate-spin text-muted-foreground" />
      <span className="ml-1.5 text-emerald-600 normal-case tracking-normal">
        {state.photos.filter(p => !p.isProcessing && !p.error).length} of {state.photos.length} ready
      </span>
      {state.photos.filter(p => p.smartCrop !== null).length > 0 && (
        <>
          <span className="mx-2 text-muted-foreground/50">·</span>
          <span className="text-primary/80 normal-case tracking-normal">
            {state.photos.filter(p => p.smartCrop !== null).length} auto-cropped
          </span>
        </>
      )}
    </h3>
    <PhotoProcessingView
      photos={state.photos}
      currentlyProcessingId={currentlyProcessingId}
    />
  </div>
) : (
  // Complete: show photo strip with View All
  <PhotoStrip
    photos={state.photos}
    autoCroppedCount={state.photos.filter(p => p.smartCrop !== null).length}
    onViewAll={() => setNavigatorOpen(true)}
  />
)}
```

### Phase 5: Delete PhotoCarousel

**File: `src/components/PhotoCarousel.tsx`**

Delete entirely - no longer used.

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/PhotoProgressDots.tsx` | Add `currentPhoto` prop, render thumbnail above active dot |
| `src/components/PhotoProcessingView.tsx` | Remove thumbnail section, add top padding, pass currentPhoto to dots |
| `src/components/PhotoStrip.tsx` | Create new component |
| `src/pages/Index.tsx` | Replace Collapsible+Carousel with conditional PhotoProcessingView/PhotoStrip |
| `src/components/PhotoCarousel.tsx` | Delete |

---

## Visual Comparison

### Processing State

**Before:**
```
PHOTOS · ◴ 3 of 16 ready · 3 auto-cropped     ▼

        +------------------+
        |                  |
        |   [128x128]      |
        |   thumbnail      |
        |                  |
        +------------------+

        ●●●●○○○○○○○○○○○○
```

**After:**
```
PHOTOS · ◴ 3 of 16 ready · 3 auto-cropped

               [48px]
                 ↓
●●●◎○○○○○○○○○○○○
    ↑
 active dot
```

### Complete State

**Before:**
```
PHOTOS (16) · 16 auto-cropped                 ▼

                    1 of 16
        +------------------+
        |                  |
        |   [180px tall]   |
   ◀    |   carousel       |    ▶
        |   single photo   |
        |                  |
        +------------------+

[Hero] [Cropped] [Edit] [🗑] [View All] [↻]
```

**After:**
```
PHOTOS (16) · 16 auto-cropped

[img][img][img][img][img][img][img]...  (56px tall strip)

        [📋 View All]
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| 1 photo processing | Single dot with thumbnail above |
| First photo | Thumbnail above leftmost dot |
| Last photo | Thumbnail above rightmost dot (may clip if near container edge) |
| 50 photos | Strip shows first ~8-10, rest clipped (View All to see all) |
| Dots wrap to multiple lines | Thumbnail follows its dot to the wrapped row |
| Error during processing | Red dot, error count shown |

---

## Cleanup

- Remove `carouselOpen` localStorage key reads
- Remove `carouselIndex` state entirely
- Remove `embla-carousel-react` import from deleted file (still used in ui/carousel.tsx)


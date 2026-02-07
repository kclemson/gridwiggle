

# Photo Management: Carousel with On-Demand Thumbnail Navigator

## Overview

Replace the always-rendered thumbnail grid with a memory-efficient carousel that shows one photo at a time, plus an on-demand thumbnail navigator that loads lazily when the user wants to see all photos at once.

---

## Design Intent

**Problem**: Rendering 20-44 thumbnails simultaneously on mobile causes memory pressure and crashes. Each thumbnail holds an Object URL to a decoded image, which the browser keeps in memory.

**Solution**: 
- Default view: Carousel showing 1 photo at a time (3 in DOM due to Embla's virtualization)
- On-demand: "View All" button opens a thumbnail strip/grid that loads progressively
- Since smart crop works well 90% of the time, most users won't need the grid frequently

**User Outcome**:
- Smooth performance on mobile with any number of photos
- Quick "View All" access when reviewing crops is needed
- Clear progress feedback during upload/processing

---

## UI Flow

```text
During Processing:
┌─────────────────────────────────────┐
│  Processing 12 of 44 photos...      │
│  ════════════════════════ 27%       │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   [Current Photo]           │    │
│  │       ○ spinner             │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ✓ 11 ready                         │
└─────────────────────────────────────┘

After Processing (Carousel View):
┌─────────────────────────────────────┐
│  44 Photos                          │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │     [Photo 12 of 44]        │    │
│  │                             │    │
│  │  ★ Hero   ✂️ Edit   🗑️       │    │
│  └─────────────────────────────┘    │
│                                     │
│     ◀  ●○○○○○  12/44  ○○○○○  ▶     │
│                                     │
│         [ View All Photos ]         │
└─────────────────────────────────────┘

Thumbnail Navigator (On-Demand Overlay):
┌─────────────────────────────────────┐
│  Select Photo              [Close]  │
│  ═══════════════════════════════    │
│                                     │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐     │
│  │1 │ │2★│ │3 │ │4 │ │5 │ │░░│ ... │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘     │
│                                     │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐     │
│  │7 │ │8 │ │9 │ │10│ │11│ │12│ ... │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘     │
│                                     │
│  Loading: 6 of 44...                │
└─────────────────────────────────────┘
```

---

## Technical Approach

### Progressive Thumbnail Loading

When the "View All" navigator opens:
1. Show skeleton placeholders for all photos immediately
2. Load thumbnails in batches of 6-8 using `requestIdleCallback` or `setTimeout`
3. Each batch replaces skeletons with actual images
4. User can tap any thumbnail (even before all load) to jump to that photo

This approach:
- Gives immediate visual feedback (skeletons)
- Doesn't block the main thread
- Allows early interaction

### Memory Management

```typescript
// Only keep thumbnails loaded while navigator is open
const [navigatorOpen, setNavigatorOpen] = useState(false);
const [loadedThumbnails, setLoadedThumbnails] = useState<Set<string>>(new Set());

// When navigator closes, we can optionally clear the set
// (browser will eventually GC unused decoded images)
```

---

## Component Structure

### New Components

| Component | Purpose |
|-----------|---------|
| `PhotoCarousel.tsx` | Main carousel view with swipe/arrows, action buttons |
| `ThumbnailNavigator.tsx` | On-demand overlay with progressive loading |
| `PhotoProcessingView.tsx` | Processing state showing current photo + progress |

### Modified Components

| Component | Changes |
|-----------|---------|
| `PhotoGrid.tsx` | Remove or deprecate (replaced by new components) |
| `Index.tsx` | Swap PhotoGrid for PhotoCarousel, add state for navigator |

---

## File Details

### 1. `src/components/PhotoCarousel.tsx` (NEW)

Main carousel component for browsing photos one at a time.

```typescript
interface PhotoCarouselProps {
  photos: PhotoItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onPhotoClick: (photoId: string) => void;  // Opens crop editor
  onRemove: (photoId: string) => void;
  onToggleHero: (photoId: string) => void;
  onViewAll: () => void;  // Opens thumbnail navigator
}
```

**Features**:
- Uses Embla carousel with touch/swipe support
- Shows current photo with crop applied (CroppedImage)
- Hero badge, edit crop button, remove button
- "View All" button at bottom
- Counter: "12 of 44"
- Previous/Next arrows (touch-friendly positioning)

---

### 2. `src/components/ThumbnailNavigator.tsx` (NEW)

On-demand overlay for viewing all thumbnails.

```typescript
interface ThumbnailNavigatorProps {
  photos: PhotoItem[];
  onSelect: (photoId: string) => void;  // Jump to photo in carousel
  onClose: () => void;
}
```

**Features**:
- Full-screen or sheet overlay
- Progressive loading with skeletons
- Small thumbnails (48-56px) in grid
- Hero badges visible
- Tap to select and close
- Loading progress indicator

**Progressive Loading Logic**:
```typescript
useEffect(() => {
  // Load thumbnails in batches to avoid memory spike
  const batchSize = 8;
  let currentBatch = 0;
  
  const loadNextBatch = () => {
    const start = currentBatch * batchSize;
    const end = Math.min(start + batchSize, photos.length);
    
    setLoadedThumbnails(prev => {
      const next = new Set(prev);
      for (let i = start; i < end; i++) {
        next.add(photos[i].id);
      }
      return next;
    });
    
    currentBatch++;
    if (end < photos.length) {
      requestIdleCallback(loadNextBatch);
    }
  };
  
  loadNextBatch();
}, [photos]);
```

---

### 3. `src/components/PhotoProcessingView.tsx` (NEW)

Processing state display during upload/smart crop.

```typescript
interface PhotoProcessingViewProps {
  photos: PhotoItem[];
  currentlyProcessingId: string | null;
  progress: number;  // 0-100
  status: string;    // "Detecting faces..."
}
```

**Features**:
- Progress bar with percentage
- "X of Y photos processed" counter
- Current photo thumbnail with spinner (only one in DOM)
- Completed/error counts

---

### 4. `src/pages/Index.tsx` (MODIFY)

**Changes**:
1. Add state for carousel index and navigator visibility
2. Track currently processing photo ID
3. Replace PhotoGrid with conditional PhotoCarousel/PhotoProcessingView
4. Add handler to jump carousel to selected photo

```typescript
// New state
const [carouselIndex, setCarouselIndex] = useState(0);
const [navigatorOpen, setNavigatorOpen] = useState(false);
const [currentlyProcessingId, setCurrentlyProcessingId] = useState<string | null>(null);

// In processSmartCrops:
for (const photo of photos) {
  setCurrentlyProcessingId(photo.id);
  // ... process
}
setCurrentlyProcessingId(null);

// Conditional rendering:
{isProcessing ? (
  <PhotoProcessingView 
    photos={state.photos}
    currentlyProcessingId={currentlyProcessingId}
    progress={smartCropProgress}
    status={processingStatus}
  />
) : (
  <PhotoCarousel
    photos={state.photos}
    currentIndex={carouselIndex}
    onIndexChange={setCarouselIndex}
    onPhotoClick={setEditingPhotoId}
    onRemove={handleRemovePhoto}
    onToggleHero={handleToggleHero}
    onViewAll={() => setNavigatorOpen(true)}
  />
)}

{navigatorOpen && (
  <ThumbnailNavigator
    photos={state.photos}
    onSelect={(photoId) => {
      const idx = state.photos.findIndex(p => p.id === photoId);
      setCarouselIndex(idx);
      setNavigatorOpen(false);
    }}
    onClose={() => setNavigatorOpen(false)}
  />
)}
```

---

### 5. `src/hooks/useCollageState.ts` (MODIFY)

**Debounce localStorage writes** to prevent main thread blocking during rapid state updates:

```typescript
// Add debounced save function
const debouncedSaveMetadata = useMemo(
  () => debounce((state: CollageState) => {
    saveMetadataToStorage(state);
  }, 300),
  []
);

// Replace saveMetadataToStorage(next) calls with debouncedSaveMetadata(next)
```

This preserves per-photo React state updates (visual feedback) while batching I/O.

---

## Thumbnail Size Considerations

For the navigator thumbnails:
- **Size**: 48-56px height (smaller than current 80px grid)
- **Why smaller**: Faster to decode, less memory per image
- **Grid layout**: `grid-cols-6` on mobile, fills width

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/PhotoCarousel.tsx` | CREATE | Main carousel view with actions |
| `src/components/ThumbnailNavigator.tsx` | CREATE | On-demand thumbnail grid with progressive load |
| `src/components/PhotoProcessingView.tsx` | CREATE | Processing state with progress |
| `src/pages/Index.tsx` | MODIFY | Swap grid for carousel, add navigator state |
| `src/hooks/useCollageState.ts` | MODIFY | Debounce localStorage writes |
| `src/components/PhotoGrid.tsx` | DEPRECATE | No longer used in main flow |

---

## Memory Impact

| Scenario | Before | After |
|----------|--------|-------|
| 44 photos uploaded | 44 thumbnails in DOM | 3 carousel slides in DOM |
| Reviewing crops | 44 thumbnails always visible | 0-44 thumbnails (on-demand) |
| Navigator closed | N/A | Thumbnails can be GC'd |

---

## Preserving Current Behavior

- **Sequential feedback**: Each photo still updates React state individually (spinner to image)
- **Smart crop accuracy**: No changes to crop calculation or storage
- **Hero toggle**: Available in carousel actions
- **Crop editor**: Accessible via tap on carousel photo
- **Desktop**: Same UI as mobile (consistent experience)


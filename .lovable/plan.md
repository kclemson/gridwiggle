

## Hero Photos Feature

Add the ability to mark photos as "heroes" which will receive larger slots in the collage layout.

### User Experience

**Marking a hero:**
1. User taps a photo in the "Smart Cropped" grid
2. CropEditor dialog opens with a toggle at the bottom: "Make this a hero photo (larger in collage)"
3. The toggle is always visible with its self-explanatory label - no conditional explanation needed
4. User adjusts crop and/or toggles hero status, then saves

**Visual feedback:**
- Thumbnails in the Smart Cropped grid show a small star badge (top-left corner) when marked as hero
- Hero photos sort to the beginning of the grid so users can easily see which ones they've marked
- The grid hint updates to: "tap to adjust or mark heroes"

**Layout effect:**
- Hero photos get weight 2.0 (double width allocation vs standard 1.0)
- This makes them visibly larger while maintaining the row-based layout algorithm
- Future expansion to 3 tiers (hero/medium/standard) is possible without data migration

### Technical Changes

**1. Data Model** (`src/types/collage.ts`)

Add `priority` field with future-proof typing:

```typescript
export type PhotoPriority = 1 | 2 | 3;  // 1=hero, 2=medium, 3=standard

export interface PhotoItem {
  // ... existing fields
  priority: PhotoPriority;  // Default: 3 (standard)
}

export interface PhotoMetadata {
  // ... existing fields  
  priority: PhotoPriority;
}
```

Using numeric priority (1/2/3) instead of boolean `isHero` allows future expansion to 3 tiers without data migration.

**2. State Management** (`src/hooks/useCollageState.ts`)

- Default new photos to `priority: 3`
- Include `priority` in persistence serialization  
- Handle migration for existing photos (default to 3 if missing)

**3. CropEditor Updates** (`src/components/CropEditor.tsx`)

Add hero toggle with self-explanatory label:

```tsx
// Updated props - onSave now includes priority
interface CropEditorProps {
  photo: PhotoItem;
  onClose: () => void;
  onSave: (photoId: string, crop: CropRegion, priority: PhotoPriority) => void;
}

// Inside component - track local hero state
const [isHero, setIsHero] = useState(photo.priority === 1);

// In footer, between the image area and buttons - simple toggle with clear label
<div className="flex items-center gap-3 mr-auto">
  <Switch 
    id="hero-toggle"
    checked={isHero} 
    onCheckedChange={setIsHero} 
  />
  <Label htmlFor="hero-toggle" className="text-sm">
    Make this a hero photo (larger in collage)
  </Label>
</div>
```

**4. PhotoThumbnail Badge** (`src/components/PhotoThumbnail.tsx`)

Add visual indicator for heroes:

```tsx
import { Star } from 'lucide-react';

// Inside render, after error overlay
{photo.priority === 1 && (
  <div className="absolute top-1 left-1 p-1 rounded-full bg-amber-500 text-white shadow-sm">
    <Star className="h-3 w-3 fill-current" />
  </div>
)}
```

**5. PhotoGrid Sorting** (`src/components/PhotoGrid.tsx`)

Sort heroes to the front:

```tsx
import { useMemo } from 'react';

// Inside component - sort by priority (heroes first)
const sortedPhotos = useMemo(() => {
  return [...photos].sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));
}, [photos]);

// Use sortedPhotos in the render
```

**6. Index.tsx Updates** (`src/pages/Index.tsx`)

- Update grid hint from "tap to adjust" to "tap to adjust or mark heroes"
- Update `handleSaveCrop` to accept priority parameter
- Pass weights to layout generator when creating collage
- Auto-regenerate when priority changes (layout affected)

```tsx
// Updated save handler
const handleSaveCrop = useCallback((photoId: string, crop: CropRegion, priority: PhotoPriority) => {
  updatePhoto(photoId, { manualCrop: crop, priority });
  setEditingPhotoId(null);
  if (state.layout) {
    // Auto-regenerate since priority affects layout
    const photoWeights = buildPhotoWeights(state.photos, photoId, priority);
    const newLayout = generateCollageLayout(state.photos, state.settings, { photoWeights });
    setLayout(newLayout);
  }
}, [updatePhoto, state.layout, state.photos, state.settings, setLayout]);

// In handleCreateCollage - build weights from priorities
const handleCreateCollage = useCallback(() => {
  const photoWeights: Record<string, number> = {};
  for (const photo of state.photos) {
    photoWeights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  
  const layout = generateCollageLayout(state.photos, state.settings, { photoWeights });
  setLayout(layout);
  setLayoutStale(false);
}, [state.photos, state.settings, setLayout]);
```

### Files to Modify

| File | Change |
|------|--------|
| `src/types/collage.ts` | Add `PhotoPriority` type and `priority` field to interfaces |
| `src/hooks/useCollageState.ts` | Default priority, persist/hydrate, migration for existing data |
| `src/components/CropEditor.tsx` | Add hero toggle switch in footer with clear label |
| `src/components/PhotoThumbnail.tsx` | Add star badge for hero photos |
| `src/components/PhotoGrid.tsx` | Sort heroes to front of grid |
| `src/pages/Index.tsx` | Update hint text, update save handler, pass weights to layout generator |

### Visual Summary

**CropEditor footer:**
```
┌─────────────────────────────────────────────────────────┐
│  [○] Make this a hero photo (larger in collage)         │
│                                                         │
│                              [Cancel]    [Save]         │
└─────────────────────────────────────────────────────────┘
```

**Smart Cropped grid with hero photos sorted first:**
```
Smart Cropped (8) — tap to adjust or mark heroes

[★ hero1] [★ hero2] [photo3] [photo4]
[photo5]  [photo6]  [photo7] [photo8]
```

**Collage result (hero photos get ~2x width):**
```
┌────────────────────┬─────────┬─────────┐
│                    │ photo3  │ photo4  │
│   ★ HERO 1         ├─────────┴─────────┤
│                    │     ★ HERO 2      │
├──────────┬─────────┼───────────────────┤
│ photo5   │ photo6  │ photo7  │ photo8  │
└──────────┴─────────┴─────────┴─────────┘
```




# Plan: Hero Photos Auto-Lock Shape to Auto

## Summary

When the user marks one or more photos as hero, automatically reset shape to "Auto" and disable the shape dropdown. This is a pragmatic MVP decision based on eval data showing hero layouts work well with auto shape but struggle with explicit shape constraints.

---

## Key Insight: No New Helper Needed

Instead of creating a new `hasAnyHeroes()` function, we'll use an inline derived check:

```typescript
const hasHeroes = state.photos.some(p => p.priority === 1);
```

This is simpler than the existing `hasHeroPhotos()` in heroLayout.ts, which checks for heroes *and* standards (needed for layout logic, but overkill for UI state).

---

## Changes Overview

| File | Changes |
|------|---------|
| `src/components/CropEditor.tsx` | Update hero checkbox label text |
| `src/components/CollageSettings.tsx` | Accept `hasHeroes` prop, move shape to right, add disabled state + hint |
| `src/pages/Index.tsx` | Derive `hasHeroes` inline, update handlers to reset shape, pass prop to CollageSettings |

---

## Detailed Changes

### 1. `src/components/CropEditor.tsx` (line ~279)

**Before:**
```
Make this a hero photo (larger in collage)
```

**After:**
```
Make this a hero photo so it is larger in the collage
```

---

### 2. `src/components/CollageSettings.tsx`

**A) Add `hasHeroes` prop:**
```typescript
interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
  photoCount: number;
  hasHeroes: boolean;  // NEW
}
```

**B) Reorder the settings bar** - move Shape to the right side:
- Current order: Shape → Background → Gap
- New order: Background → Gap → Shape

**C) Update disabled logic and hint:**
```typescript
const shapeDisabled = hasHeroes || !canControlShape;
const shapeHint = hasHeroes 
  ? "(heroes use auto)" 
  : !canControlShape 
    ? "(8+ photos)" 
    : null;
```

**D) Add HTML title tooltip for clarity:**
```tsx
<div 
  className="flex items-center gap-2"
  title={hasHeroes ? "Shape is set to Auto when photos are marked as heroes" : undefined}
>
```

---

### 3. `src/pages/Index.tsx`

**A) Derive `hasHeroes` from state:**
```typescript
const hasHeroes = state.photos.some(p => p.priority === 1);
```

**B) Update `handleSaveCrop` to reset shape when adding hero:**
```typescript
const handleSaveCrop = useCallback((photoId: string, crop: CropRegion, priority: PhotoPriority) => {
  updatePhoto(photoId, { manualCrop: crop, priority });
  setEditingPhotoId(null);
  
  // Reset shape to auto when adding a hero
  if (priority === 1 && state.settings.shape !== 'auto') {
    updateSettings({ shape: 'auto' });
  }
  
  if (state.layout) {
    regenerateCollage({ 
      priorityOverride: { photoId, priority },
      cropOverride: { photoId, crop },
      settings: priority === 1 ? { ...state.settings, shape: 'auto' } : undefined,
    });
  }
}, [updatePhoto, state.layout, state.settings, updateSettings, regenerateCollage]);
```

**C) Update `handleToggleHero` to reset shape when adding hero:**
```typescript
const handleToggleHero = useCallback((photoId: string) => {
  const photo = state.photos.find(p => p.id === photoId);
  if (!photo) return;
  
  const newPriority: PhotoPriority = photo.priority === 1 ? 3 : 1;
  updatePhoto(photoId, { priority: newPriority });
  
  // Reset shape to auto when adding a hero
  if (newPriority === 1 && state.settings.shape !== 'auto') {
    updateSettings({ shape: 'auto' });
  }
  
  if (state.layout) {
    regenerateCollage({ 
      priorityOverride: { photoId, priority: newPriority },
      settings: newPriority === 1 ? { ...state.settings, shape: 'auto' } : undefined,
    });
  }
}, [state.photos, state.layout, state.settings, updatePhoto, updateSettings, regenerateCollage]);
```

**D) Pass `hasHeroes` to CollageSettings:**
```tsx
<CollageSettings
  settings={state.settings}
  onUpdate={handleUpdateSettings}
  photoCount={state.photos.length}
  hasHeroes={hasHeroes}
/>
```

---

## UI Before/After

**Before (shape on left):**
```
Shape: Auto | Background: ■ | Gap: ━━━━ 8px
```

**After (shape on right, when heroes present):**
```
Background: ■ | Gap: ━━━━ 8px | Shape: Auto (heroes use auto)
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Remove last hero | Shape dropdown re-enables automatically |
| Add photos with existing hero | Shape stays 'auto', dropdown stays disabled |
| CropEditor sets hero | Same auto-reset logic applies |
| Photo count drops below threshold | Both conditions checked independently |


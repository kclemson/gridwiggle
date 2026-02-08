
# Prevent Layout Re-shuffle When Un-marking Hero

## Problem

When a user un-marks a hero photo (removes star), the app currently triggers a full layout regeneration with `randomize: true`. This causes all photos to flip to new positions, which is disorienting since the layout "shifts underneath" the user's cursor/finger.

## Desired Behavior

Un-heroing a photo should **not** change the layout. The existing layout remains in place. If the user wants a new layout, they can explicitly click the refresh button.

## Technical Change

### File: `src/pages/Index.tsx`

**Location:** `handleToggleHero` function (lines 415-434)

**Current logic:**
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
    regenerateCollage({                           // ← ALWAYS regenerates
      priorityOverride: { photoId, priority: newPriority },
      settings: newPriority === 1 ? { ...state.settings, shape: 'auto' } : undefined,
      randomize: true,
    });
  }
}, [...]);
```

**Updated logic:**
```typescript
const handleToggleHero = useCallback((photoId: string) => {
  const photo = state.photos.find(p => p.id === photoId);
  if (!photo) return;
  
  const newPriority: PhotoPriority = photo.priority === 1 ? 3 : 1;
  updatePhoto(photoId, { priority: newPriority });
  
  // Only regenerate when ADDING a hero (new layout needed for hero prominence)
  // Un-heroing should preserve the existing layout
  if (newPriority === 1) {
    // Reset shape to auto when adding a hero
    if (state.settings.shape !== 'auto') {
      updateSettings({ shape: 'auto' });
    }
    
    if (state.layout) {
      regenerateCollage({ 
        priorityOverride: { photoId, priority: newPriority },
        settings: { ...state.settings, shape: 'auto' },
        randomize: true,
      });
    }
  }
  // When un-heroing (newPriority === 3): just update state, keep existing layout
}, [...]);
```

## Behavior Summary

| Action | Old Behavior | New Behavior |
|--------|-------------|--------------|
| **Mark as hero** (star ON) | Full regenerate with shuffle | Same - regenerate with shuffle |
| **Un-mark hero** (star OFF) | Full regenerate with shuffle | No regeneration - layout preserved |

## Why This Works

The layout stores `photoId` references in cells, not priority information. When a photo is un-heroed:
- Its position in the layout remains unchanged
- Only the metadata (`priority`) is updated in state
- The star icon updates visually (no longer filled)
- No layout recalculation needed

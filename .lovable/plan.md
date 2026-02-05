

# Plan: Force Auto Shape for Small Photo Sets

## Overview

Restrict shape selection to "Auto" when photo count is below 6, since achieving specific aspect ratios (landscape, portrait, square) is mathematically constrained with few photos.

## Threshold Constant

Add `MIN_PHOTOS_FOR_SHAPE_CONTROL = 6` to `src/types/collage.ts` as a single source of truth.

---

## Files to Change

### 1. `src/types/collage.ts`
Add the shared constant at the end of the file:

```typescript
/**
 * Minimum photos required to allow shape control.
 * With fewer photos, aspect ratio constraints are too hard to satisfy.
 */
export const MIN_PHOTOS_FOR_SHAPE_CONTROL = 6;
```

---

### 2. `src/test/layout/layoutAdapter.ts`
Update `generateTestBatch` to only use 'auto' shape for small photo counts:

```typescript
import { MIN_PHOTOS_FOR_SHAPE_CONTROL } from '@/types/collage';

export function generateTestBatch(count: number): LayoutTestCase[] {
  const cases: LayoutTestCase[] = [];
  
  for (const photoCount of TEST_PHOTO_COUNTS) {
    // Only allow shape control when we have enough photos
    const shapes: CollageSettings['shape'][] = 
      photoCount < MIN_PHOTOS_FOR_SHAPE_CONTROL 
        ? ['auto'] 
        : ['auto', 'landscape', 'portrait', 'square'];
    
    for (const shape of shapes) {
      for (const hasHero of [true, false]) {
        // ...existing logic
      }
    }
  }
  // ...
}
```

---

### 3. `src/components/CollageSettings.tsx`
Add `photoCount` prop and conditionally show shape options:

```typescript
import { MIN_PHOTOS_FOR_SHAPE_CONTROL } from '@/types/collage';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
  photoCount: number;  // NEW
}

export function CollageSettings({ settings, onUpdate, photoCount }: CollageSettingsProps) {
  const canControlShape = photoCount >= MIN_PHOTOS_FOR_SHAPE_CONTROL;
  
  // In the Select component:
  // - Disable when canControlShape is false
  // - Only show Landscape/Portrait/Square options when canControlShape is true
  // - Add "(need 6+ photos)" hint when disabled
}
```

---

### 4. `src/pages/Index.tsx`
Two changes:

**a) Pass photoCount to CollageSettings:**
```tsx
<CollageSettings
  settings={state.settings}
  onUpdate={handleUpdateSettings}
  photoCount={state.photos.length}
/>
```

**b) Auto-reset shape in handleRemovePhoto when count drops below threshold:**
```typescript
import { MIN_PHOTOS_FOR_SHAPE_CONTROL } from '@/types/collage';

const handleRemovePhoto = useCallback((photoId: string) => {
  removePhoto(photoId);
  const remainingCount = state.photos.length - 1;
  
  // Reset to auto if we drop below threshold
  if (remainingCount < MIN_PHOTOS_FOR_SHAPE_CONTROL && state.settings.shape !== 'auto') {
    updateSettings({ shape: 'auto' });
  }
  
  if (state.layout) {
    const remainingPhotos = state.photos.filter(p => p.id !== photoId);
    regenerateCollage({ photos: remainingPhotos });
  }
}, [removePhoto, state.layout, state.photos, state.settings.shape, regenerateCollage, updateSettings]);
```

---

## UX Behavior

| Photo Count | Shape Dropdown | Available Options |
|-------------|----------------|-------------------|
| 2-5         | Disabled, shows "Auto" | Auto only |
| 6+          | Enabled | Auto, Landscape, Portrait, Square |

When a user removes photos and count drops below 6, the shape automatically resets to "Auto" (no jarring error or broken state).

---

## Test Generation Impact

For layouts with 3-5 photos, only `'auto'` shape test cases will be generated. This eliminates unfair "wrong-shape" ratings for mathematically impossible configurations.


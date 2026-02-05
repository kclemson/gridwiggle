

# Plan: Per-Shape Minimum Photo Thresholds

## Summary

Replace the single `MIN_PHOTOS_FOR_SHAPE_CONTROL` constant (currently 6) with per-shape minimums:
- **Portrait/Landscape**: 6 photos
- **Square**: 10 photos

This affects the UI (dropdown options), the algorithm enforcement, and the test case generation.

## Rationale

Square layouts have the tightest mathematical constraints (aspect 0.95-1.05, relaxed to 0.76-1.26). With only 6 photos, the available row configurations often cannot satisfy this constraint, especially with directionally-biased photo sets. Portrait and landscape are more forgiving.

## Files to Modify

| File | Change |
|------|--------|
| `src/types/collage.ts` | Replace single constant with per-shape lookup function |
| `src/components/CollageSettings.tsx` | Show/hide each shape option based on its specific threshold |
| `src/pages/Index.tsx` | Update shape reset logic to use per-shape threshold |
| `src/test/layout/layoutAdapter.ts` | Filter shapes in test generation based on photo count |

## Detailed Changes

### 1. `src/types/collage.ts`

Replace the single constant with a per-shape lookup:

```typescript
/**
 * Minimum photos required for each shape option.
 * Square is hardest to satisfy, requiring more photos.
 */
export const MIN_PHOTOS_FOR_SHAPE: Record<'landscape' | 'portrait' | 'square', number> = {
  landscape: 6,
  portrait: 6,
  square: 10,
};

/**
 * Check if a shape is available for a given photo count.
 * 'auto' is always available.
 */
export function isShapeAvailable(
  shape: 'auto' | 'landscape' | 'portrait' | 'square',
  photoCount: number
): boolean {
  if (shape === 'auto') return true;
  return photoCount >= MIN_PHOTOS_FOR_SHAPE[shape];
}
```

Keep `MIN_PHOTOS_FOR_SHAPE_CONTROL = 6` for backward compatibility (any shape control requires at least 6 photos).

### 2. `src/components/CollageSettings.tsx`

Update the dropdown to conditionally show each shape based on its specific threshold:

```typescript
import { 
  CollageSettings as CollageSettingsType, 
  MIN_PHOTOS_FOR_SHAPE_CONTROL,
  isShapeAvailable 
} from '@/types/collage';

// ...

export function CollageSettings({ settings, onUpdate, photoCount }: CollageSettingsProps) {
  const canControlShape = photoCount >= MIN_PHOTOS_FOR_SHAPE_CONTROL;
  
  // Per-shape availability
  const canLandscape = isShapeAvailable('landscape', photoCount);
  const canPortrait = isShapeAvailable('portrait', photoCount);
  const canSquare = isShapeAvailable('square', photoCount);
  
  return (
    // ...
    <SelectContent>
      <SelectItem value="auto">Auto</SelectItem>
      {canLandscape && <SelectItem value="landscape">Landscape</SelectItem>}
      {canPortrait && <SelectItem value="portrait">Portrait</SelectItem>}
      {canSquare && <SelectItem value="square">Square-ish</SelectItem>}
    </SelectContent>
    // ...
  );
}
```

The dropdown is always enabled if any shape is available (6+ photos). The hint text "(6+ photos)" remains unchanged since that's still the minimum for any shape control.

### 3. `src/pages/Index.tsx`

Update the reset-to-auto logic when photos are removed:

```typescript
import { 
  // ...existing imports...
  isShapeAvailable 
} from '@/types/collage';

// In handleRemovePhoto:
// Reset to auto if current shape is no longer available
if (!isShapeAvailable(state.settings.shape, remainingCount)) {
  updateSettings({ shape: 'auto' });
}
```

This handles the case where a user has "square" selected with 10 photos, then removes photos down to 8 - it will auto-reset to 'auto'.

### 4. `src/test/layout/layoutAdapter.ts`

Update test batch generation to respect per-shape thresholds:

```typescript
import { 
  // ...existing imports...
  isShapeAvailable,
} from '@/types/collage';

// In generateTestBatch:
for (const photoCount of TEST_PHOTO_COUNTS) {
  // Build list of available shapes for this photo count
  const shapes: CollageSettings['shape'][] = ['auto'];
  if (isShapeAvailable('landscape', photoCount)) shapes.push('landscape');
  if (isShapeAvailable('portrait', photoCount)) shapes.push('portrait');
  if (isShapeAvailable('square', photoCount)) shapes.push('square');
  
  for (const shape of shapes) {
    // ...existing case generation...
  }
}
```

This means:
- 5 photos: only `['auto']`
- 6-9 photos: `['auto', 'landscape', 'portrait']`
- 10+ photos: `['auto', 'landscape', 'portrait', 'square']`

## Expected Outcome

| Photo Count | Available Shapes |
|-------------|------------------|
| 1-5 | Auto only |
| 6-9 | Auto, Landscape, Portrait |
| 10+ | Auto, Landscape, Portrait, Square |

## User Experience

- Users with fewer than 6 photos see only "Auto" in the dropdown
- Users with 6-9 photos see Auto, Landscape, Portrait (no Square)
- Users with 10+ photos see all options
- No explanatory text needed - options simply appear/disappear
- If a user removes photos while Square is selected, it resets to Auto

## Test Generation Impact

The `BATCH_SIZE` calculation in `LayoutRating.tsx` may need updating. Current formula assumes:
- 5 photos: 1 shape x 2 hero = 2
- 6+ photos (10 counts): 4 shapes x 2 hero = 80 (but not all shapes available for all counts now)

New calculation:
- 5 photos: 1 shape = 1 case
- 6-9 photos (4 counts): 3 shapes = 12 cases
- 10+ photos (6 counts): 4 shapes = 24 cases
- Total base: 1 + 12 + 24 = 37 combinations

However, since we randomly vary hero/no-hero, the actual batch generation doesn't need to change - it just generates fewer square test cases for counts 6-9.


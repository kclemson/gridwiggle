

# Rename `orientation` to `shape` and Thread Through Content-Only Layout

## Overview

This plan addresses two related issues:
1. **Naming inconsistency**: The UI uses "Shape" but the code uses `orientation`
2. **Shape ignored for content-only layouts**: The shape setting isn't passed through to the scoring function

---

## Part 1: Rename `orientation` to `shape`

### Files to modify

| File | Changes |
|------|---------|
| `src/types/collage.ts` | Rename field in `CollageSettings` interface |
| `src/hooks/useCollageState.ts` | Update default settings |
| `src/components/CollageSettings.tsx` | Update value/onChange references |
| `src/pages/Index.tsx` | Update settings change detection |
| `src/lib/collageLayout.ts` | Update function parameters and references |
| `src/lib/heroLayout.ts` | Update log statement |

### Detailed changes

**`src/types/collage.ts`** (line 47)
```typescript
// Change from:
export interface CollageSettings {
  orientation: 'auto' | 'landscape' | 'portrait' | 'square';

// Change to:
export interface CollageSettings {
  shape: 'auto' | 'landscape' | 'portrait' | 'square';
```

**`src/hooks/useCollageState.ts`** (line 23)
```typescript
// Change from:
const defaultSettings: CollageSettings = {
  orientation: 'auto',

// Change to:
const defaultSettings: CollageSettings = {
  shape: 'auto',
```

**`src/components/CollageSettings.tsx`** (lines 30-31)
```typescript
// Change from:
value={settings.orientation}
onValueChange={(value) => onUpdate({ orientation: value as CollageSettingsType['orientation'] })}

// Change to:
value={settings.shape}
onValueChange={(value) => onUpdate({ shape: value as CollageSettingsType['shape'] })}
```

**`src/pages/Index.tsx`** (line 224)
```typescript
// Change from:
if (state.layout && ('gapSize' in updates || 'orientation' in updates)) {

// Change to:
if (state.layout && ('gapSize' in updates || 'shape' in updates)) {
```

**`src/lib/collageLayout.ts`** (lines 34, 38, 610)
```typescript
// Change from:
function getMinPhotosPerRowRange(
  n: number,
  orientation: CollageSettings['orientation']
): [number, number] {
  // ...
  switch (orientation) {

// Change to:
function getMinPhotosPerRowRange(
  n: number,
  shape: CollageSettings['shape']
): [number, number] {
  // ...
  switch (shape) {

// And line 610:
const [minRange, maxRange] = getMinPhotosPerRowRange(n, settings.shape);
```

**`src/lib/heroLayout.ts`** (line 1635)
```typescript
// Change from:
shape: settings.orientation,

// Change to:
shape: settings.shape,
```

---

## Part 2: Thread Shape Through Content-Only Layout Pipeline

This is the critical fix. Currently `buildContentRowsBlock` hardcodes `shape: 'auto'`, so the direction penalty is never applied for collages without hero photos.

### Files to modify

| File | Changes |
|------|---------|
| `src/lib/layoutBlocks.ts` | Add `shape` parameter to `buildContentRowsBlock` |
| `src/lib/heroLayout.ts` | Add `shape` to `generateContentOnlyLayout`, pass from caller |

### Detailed changes

**`src/lib/layoutBlocks.ts`** - Update `buildContentRowsBlock` signature (around line 382)
```typescript
// Change from:
export function buildContentRowsBlock(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  packPhotosIntoRegion: (...) => ...,
  minPhotosPerRow: number = 2
): ContentRowsBlock | null {
  // ...
  const result = packPhotosIntoRegion(photos, {
    // ...
    shape: 'auto', // <-- HARDCODED
  });

// Change to:
export function buildContentRowsBlock(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  packPhotosIntoRegion: (...) => ...,
  minPhotosPerRow: number = 2,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto'  // NEW
): ContentRowsBlock | null {
  // ...
  const result = packPhotosIntoRegion(photos, {
    // ...
    shape,  // <-- NOW USES PARAMETER
  });
```

**`src/lib/heroLayout.ts`** - Update `generateContentOnlyLayout` (line 1568)
```typescript
// Change from:
function generateContentOnlyLayout(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning
): CollageLayout {
  // ...
  const contentBlock = buildContentRowsBlock(
    blockPhotos,
    canvasWidth,
    gap,
    packPhotosIntoRegion,
    tuning.minPhotosPerRow
  );

// Change to:
function generateContentOnlyLayout(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto'  // NEW
): CollageLayout {
  // ...
  const contentBlock = buildContentRowsBlock(
    blockPhotos,
    canvasWidth,
    gap,
    packPhotosIntoRegion,
    tuning.minPhotosPerRow,
    shape  // NEW
  );
```

**`src/lib/heroLayout.ts`** - Pass shape from caller (line 1642)
```typescript
// Change from:
return generateContentOnlyLayout(standards, BASE_WIDTH, gap, randomize, tuning);

// Change to:
return generateContentOnlyLayout(standards, BASE_WIDTH, gap, randomize, tuning, settings.shape);
```

---

## Data Flow After Fix

```text
User selects Shape=Square
       ↓
CollageSettings.shape = 'square'
       ↓
generateCollageLayout(settings)
       ↓
getMinPhotosPerRowRange(n, settings.shape) → portrait/square/landscape ranges
       ↓
generateHeroLayout(settings)
       ↓
generateContentOnlyLayout(..., settings.shape)   ← NEW
       ↓
buildContentRowsBlock(..., shape='square')       ← NEW
       ↓
packPhotosIntoRegion({shape: 'square'})          ← WAS 'auto'!
       ↓
scorePartition(shape='square')
       ↓
directionPenalty = 10.0 * |resultAspect - 1.0|   ← NOW WORKS!
```

---

## Expected Behavior After Fix

**24 photos, Shape=Square:**
- Direction penalty now applied: layouts with aspect 1.4 get penalty of 4.0
- Square-ish layouts (aspect ~1.0) preferred even if uniformity is slightly worse

**24 photos, Shape=Portrait:**
- Sparse penalty range now [2, 3.4] (from previous fix)
- Direction penalty actively prefers taller layouts (6-8+ rows)

**24 photos, Shape=Landscape:**
- Direction penalty actively prefers wider layouts (4-5 rows)

**24 photos, Shape=Auto:**
- No direction penalty, layout emerges naturally from density constraints

---

## Migration Note

The rename from `orientation` to `shape` will affect persisted state in localStorage. Users with existing saved collages will see `orientation` in their stored data. The `loadMetadataFromStorage` function already merges with `defaultSettings`, so the old `orientation` key will be ignored and `shape` will default to `'auto'`.

To preserve existing settings, we can add a one-time migration in `loadMetadataFromStorage`:
```typescript
// One-time migration from orientation to shape
if ('orientation' in parsed.settings && !('shape' in parsed.settings)) {
  parsed.settings.shape = parsed.settings.orientation;
  delete parsed.settings.orientation;
}
```


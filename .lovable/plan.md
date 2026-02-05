

# Thread minPhotosPerRow Through the Call Chain

## Problem

`minPhotosPerRow` is defined in `scorePartition` but never actually passed - all callers use the hardcoded default of `2`. This explains why setting it to `6` in the UI has no effect.

## Call Chain to Fix

```text
TuningSection (UI)
    ↓
generateBlockBasedHeroLayout (heroLayout.ts)
    ↓
buildContentRowsBlock (layoutBlocks.ts)
    ↓
packPhotosIntoRegion (collageLayout.ts)
    ↓
findBestRowSplit (collageLayout.ts)
    ↓
scorePartition (collageLayout.ts) ← only place that uses minPhotosPerRow
```

## Technical Changes

### 1. Update `RegionPackOptions` interface (collageLayout.ts)

Add `minPhotosPerRow` to the options:

```typescript
export interface RegionPackOptions {
  // ... existing fields ...
  
  /** Minimum photos per row for scoring (default: 2) */
  minPhotosPerRow?: number;
}
```

### 2. Update `findBestRowSplit` signature (collageLayout.ts)

Add parameter and pass to all `scorePartition` calls:

```typescript
function findBestRowSplit(
  dims: PhotoDimension[],
  targetAspect: number,
  isLandscape: boolean,
  randomize: boolean = false,
  minPhotosPerRow: number = 2  // NEW
): PhotoDimension[][] {
  // ...
  
  // Inside enumeration loop:
  const score = scorePartition(partition, targetAspect, isLandscape, 1200, minPhotosPerRow);
  
  // Inside sampling loop:
  const score = scorePartition(partition, targetAspect, isLandscape, 1200, minPhotosPerRow);
}
```

### 3. Update `packPhotosIntoRegion` (collageLayout.ts)

Extract option and pass to `findBestRowSplit`:

```typescript
export function packPhotosIntoRegion(
  dims: PhotoDimension[],
  options: RegionPackOptions
): RegionPackResult {
  const { 
    // ... existing ...
    minPhotosPerRow = 2  // NEW
  } = options;
  
  // ...
  
  const partition = findBestRowSplit(
    dims, 
    effectiveTargetAspect, 
    isLandscape, 
    false,
    minPhotosPerRow  // Pass through
  );
}
```

### 4. Update `buildContentRowsBlock` type signature (layoutBlocks.ts)

The function receives `packPhotosIntoRegion` as a parameter, so update the type:

```typescript
export function buildContentRowsBlock(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  packPhotosIntoRegion: (
    dims: PhotoDimension[], 
    options: { 
      width: number; 
      gap: number; 
      offsetX: number; 
      offsetY: number; 
      isLandscape: boolean;
      minPhotosPerRow?: number;  // NEW
    }
  ) => { cells: CollageCell[]; achievedHeight: number; partition: PhotoDimension[][] },
  minPhotosPerRow: number = 2  // NEW parameter
): ContentRowsBlock | null {
  // ...
  
  const result = packPhotosIntoRegion(photos, {
    width: canvasWidth,
    gap,
    offsetX: 0,
    offsetY: 0,
    isLandscape: true,
    minPhotosPerRow,  // Pass through
  });
}
```

### 5. Update `generateBlockBasedHeroLayout` (heroLayout.ts)

Pass `tuning.minPhotosPerRow` when building content blocks:

```typescript
// When calling buildContentRowsBlock:
const contentBlock = buildContentRowsBlock(
  remainingPhotos,
  canvasWidth,
  gap,
  packPhotosIntoRegion,
  tuning.minPhotosPerRow  // NEW
);
```

## Files to Modify

1. **`src/lib/collageLayout.ts`**
   - Add `minPhotosPerRow` to `RegionPackOptions` interface
   - Add parameter to `findBestRowSplit`, pass to `scorePartition` calls
   - Extract and pass in `packPhotosIntoRegion`

2. **`src/lib/layoutBlocks.ts`**
   - Add `minPhotosPerRow` parameter to `buildContentRowsBlock`
   - Update the `packPhotosIntoRegion` type to include `minPhotosPerRow`
   - Pass through to the function call

3. **`src/lib/heroLayout.ts`**
   - Pass `tuning.minPhotosPerRow` to `buildContentRowsBlock` calls

## Result

After this change, setting `minPhotosPerRow=6` in the UI will actually influence the scoring. We can then evaluate if the penalty weight (currently `0.5`) is sufficient or needs adjustment.


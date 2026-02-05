

# Unify Layout Generation into Single Block-Based Path

## Status: ✅ COMPLETED

## Problem

We have two divergent code paths:

1. **Standard path** (`collageLayout.ts`): Uses `findBestRowSplit` → `calculateLayout` directly
2. **Hero path** (`heroLayout.ts`): Uses block architecture with `buildContentRowsBlock` → `stackBlocks`

As features evolve (variety randomization, tuning parameters, new block types), maintaining both paths becomes increasingly difficult. They'll drift apart.

## Key Insight

The block-based architecture in `layoutBlocks.ts` is **already more general** than the standard path:

- A layout with heroes = hero-unit block(s) + content-rows block(s)
- A layout **without** heroes = just content-rows block(s)

The "no hero" case is simply the hero case with zero hero-unit blocks.

## Proposed Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                   generateCollageLayout()                        │
│         (single entry point in collageLayout.ts)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Unified Layout Generation Flow                      │
│                                                                  │
│  1. Extract dimensions, determine orientation/target             │
│  2. Apply variety randomization (minPhotosPerRow, etc.)          │
│  3. Separate heroes from standards                               │
│  4. Build blocks:                                                │
│     - For each hero: buildHeroUnitBlock()                        │
│     - Remaining photos: buildContentRowsBlock()                  │
│  5. stackBlocks() → final layout                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Changes

### 1. Rename and Generalize `generateHeroLayout`

Rename to `generateBlockBasedLayout` and make it work for the zero-hero case:

```typescript
// src/lib/heroLayout.ts → becomes the unified layout generator

export function generateBlockBasedLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  targetAspect: number | undefined,
  weights: Record<string, number>,
  randomize: boolean,
  tuning: LayoutTuning
): CollageLayout {
  const gap = settings.gapSize;
  const dims = getPhotoDimensions(photos, weights);
  const heroes = dims.filter(d => d.weight >= 2.0);
  const standards = dims.filter(d => d.weight < 2.0);

  // Apply variety randomization (works for both hero and no-hero cases)
  let layoutTuning = tuning;
  if (targetAspect === undefined && randomize) {
    const minRowOptions = [2, 3, 4, 5];
    const randomMinPerRow = minRowOptions[Math.floor(Math.random() * minRowOptions.length)];
    layoutTuning = { ...tuning, minPhotosPerRow: randomMinPerRow };
  }

  // Route based on hero count
  if (heroes.length === 0) {
    // No heroes: just content rows
    return generateContentOnlyLayout(standards, canvasWidth, gap, layoutTuning);
  }

  if (heroes.length === 1) {
    return generateSingleHeroLayout(heroes[0], standards, canvasWidth, gap, randomize, targetAspect, layoutTuning);
  }

  return generateMultiHeroLayout(heroes, standards, canvasWidth, gap, randomize);
}
```

### 2. Add Content-Only Layout Function

```typescript
function generateContentOnlyLayout(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  tuning: LayoutTuning
): CollageLayout {
  // Build content rows using the same block primitive
  const contentBlock = buildContentRowsBlock(
    photos,
    canvasWidth,
    gap,
    packPhotosIntoRegion,
    tuning.minPhotosPerRow
  );
  
  if (!contentBlock) {
    return { width: canvasWidth, height: 800, cells: [] };
  }
  
  // Single block, no need for stackBlocks
  return {
    width: canvasWidth,
    height: contentBlock.height,
    cells: contentBlock.cells,
  };
}
```

### 3. Simplify `generateCollageLayout`

```typescript
// src/lib/collageLayout.ts

export function generateCollageLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  options?: LayoutOptions
): CollageLayout {
  if (photos.length === 0) {
    return { width: 1200, height: 800, cells: [] };
  }
  
  // Handle single photo edge case
  if (photos.length === 1) {
    // ... existing single-photo logic
  }
  
  const weights = options?.photoWeights ?? {};
  const dims = getPhotoDimensions(photos, weights);
  
  // Determine target aspect ratio
  const targetAspect = determineTargetAspect(settings.orientation, dims);
  
  // Single unified path for all layouts
  return generateBlockBasedLayout(
    photos,
    settings,
    targetAspect,
    weights,
    options?.randomize ?? false,
    options?.tuning
  );
}
```

### 4. Remove Duplicated Helper: `hasHeroPhotos`

The check for heroes happens inside `generateBlockBasedLayout`, so `hasHeroPhotos` is no longer needed as a separate routing decision.

## Benefits

| Before | After |
|--------|-------|
| Two code paths with separate variety logic | Single path with shared variety logic |
| Hero-only minPhotosPerRow randomization | Randomization works for ALL layouts |
| Different helper functions used | Shared block primitives everywhere |
| `hasHeroPhotos` routing decision in caller | Internal routing inside single function |

## Files to Modify

1. **`src/lib/heroLayout.ts`**
   - Rename `generateHeroLayout` → `generateBlockBasedLayout`
   - Add `generateContentOnlyLayout` for zero-hero case
   - Move variety randomization to work for all cases

2. **`src/lib/collageLayout.ts`**
   - Remove `findBestRowSplit` / `calculateLayout` direct usage
   - Remove `hasHeroPhotos` routing check
   - Call `generateBlockBasedLayout` for all multi-photo layouts
   - Keep utility functions (`reflowAfterSwap`, `swapPhotosInLayout`)

## Incremental Approach

This can be done in phases:

**Phase 1**: Add `generateContentOnlyLayout` that uses block primitives
**Phase 2**: Route zero-hero case through it inside existing `generateHeroLayout`
**Phase 3**: Rename and clean up once both paths work
**Phase 4**: Remove dead code from `collageLayout.ts`


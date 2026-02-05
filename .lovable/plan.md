

# Plan: Extract Layout Math Helpers into Dedicated Module

## Problem

The layout-related files have grown organically with duplicated utilities:

| Function/Type | `heroLayout.ts` | `collageLayout.ts` | `layoutBlocks.ts` |
|--------------|-----------------|-------------------|-------------------|
| `PhotoDimension` | Yes | Yes | Yes |
| `shuffleArray` | Yes | Yes | - |
| `getPhotoDimensions` | Yes | Yes | - |
| `coefficientOfVariation` | Yes | Yes | - |
| `calculateOptimalHeroFraction` | Yes | - | - |

Adding the new aspect-geometry math (from the previous plan) would exacerbate this.

---

## Solution: Create `src/lib/layoutMath.ts`

A single source of truth for:

1. **Shared types** - `PhotoDimension`
2. **Statistical utilities** - `coefficientOfVariation`, `mean`, `variance`
3. **Array utilities** - `shuffleArray`
4. **Photo dimension extraction** - `getPhotoDimensions`
5. **Aspect ratio geometry** - the new unified formulas

---

## File Structure After Refactor

```text
src/lib/
├── layoutMath.ts       ← NEW: All pure math/statistical helpers
├── heroLayout.ts       ← Imports from layoutMath, keeps hero-specific logic
├── collageLayout.ts    ← Imports from layoutMath, keeps scoring/packing
├── layoutBlocks.ts     ← Imports PhotoDimension from layoutMath
├── cropUtils.ts        ← Unchanged
├── imageUtils.ts       ← Unchanged
└── ...
```

---

## New File: `src/lib/layoutMath.ts`

```typescript
/**
 * Layout Math Utilities
 * 
 * Pure mathematical functions for layout calculations.
 * No side effects, no DOM, no state - just math.
 */

import { PhotoItem, LayoutTuning, CropRegion } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';

// ============================================================================
// Shared Types
// ============================================================================

/**
 * Photo dimensions extracted for layout calculations.
 * This is THE canonical type used across all layout modules.
 */
export interface PhotoDimension {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
  weight: number;
}

// ============================================================================
// Array Utilities
// ============================================================================

/** Fisher-Yates shuffle - returns new shuffled array */
export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// Statistical Utilities
// ============================================================================

/** Calculate mean of numeric array */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Calculate variance of numeric array */
export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
}

/** Coefficient of variation: stddev / mean (0 = perfectly uniform) */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  if (avg === 0) return 0;
  return Math.sqrt(variance(values)) / avg;
}

// ============================================================================
// Photo Dimension Extraction
// ============================================================================

/**
 * Extract layout-relevant dimensions from PhotoItems.
 * Uses display crop (manual or smart) when available.
 */
export function getPhotoDimensions(
  photos: PhotoItem[], 
  weights: Record<string, number> = {}
): PhotoDimension[] {
  return photos.map((photo) => {
    const crop = getDisplayCrop(photo);
    const width = crop ? crop.width : photo.originalWidth;
    const height = crop ? crop.height : photo.originalHeight;
    return {
      id: photo.id,
      width,
      height,
      aspectRatio: width / height,
      weight: weights[photo.id] ?? 1,
    };
  });
}

// ============================================================================
// Aspect Ratio Geometry
// ============================================================================

/**
 * Calculate optimal row count for beside photos based on unified aspect geometry.
 * 
 * Formula: r = sqrt(besideCount * avgBesideAR / heroAR)
 * 
 * This single expression composes all inputs:
 * - More beside photos → more rows needed (n in numerator)
 * - Taller beside photos (low AR) → fewer rows (AR in numerator)  
 * - Wider hero (high AR) → fewer rows (AR in denominator)
 * 
 * The result is the row count where beside photos naturally fill
 * the same height as the hero without excessive scaling.
 */
export function calculateOptimalBesideRowCount(
  heroAspect: number,
  besidePhotos: PhotoDimension[]
): number {
  if (besidePhotos.length === 0) return 1;
  
  const avgBesideAR = mean(besidePhotos.map(p => p.aspectRatio));
  
  // The unified formula - all inputs compose together
  const optimalRows = Math.sqrt(besidePhotos.length * avgBesideAR / heroAspect);
  
  // Clamp to valid range [1, 3] and round to nearest integer
  return Math.max(1, Math.min(3, Math.round(optimalRows)));
}

/**
 * Calculate maximum beside photo count based on total photos and aspect contrast.
 * 
 * Aspect contrast (heroAR / avgBesideAR) affects perception:
 * - High contrast (landscape hero + portrait beside) → photos feel smaller
 *   → can pack more beside while maintaining hero prominence
 * - Low contrast (similar shapes) → photos compete visually
 *   → need fewer beside to preserve hero dominance
 * 
 * Formula: maxBeside = (totalCount - minBelow) * baseFraction * contrastModifier
 */
export function calculateMaxBesideCount(
  heroAspect: number,
  candidatePhotos: PhotoDimension[],
  totalNonHeroCount: number,
  tuning: Pick<LayoutTuning, 
    'baseMaxBesideFraction' | 'minBelowPhotos' | 
    'aspectContrastFloor' | 'aspectContrastCap'>
): number {
  // Calculate aspect contrast
  const avgCandidateAR = candidatePhotos.length > 0
    ? mean(candidatePhotos.map(p => p.aspectRatio))
    : 1.0;
  
  const aspectContrast = heroAspect / avgCandidateAR;
  
  // Clamp contrast modifier to reasonable range
  const contrastModifier = Math.max(
    tuning.aspectContrastFloor,
    Math.min(tuning.aspectContrastCap, aspectContrast)
  );
  
  // Calculate max beside with contrast-adjusted fraction
  const adjustedFraction = tuning.baseMaxBesideFraction * contrastModifier;
  const maxFromFraction = Math.floor(totalNonHeroCount * adjustedFraction);
  
  // Ensure we reserve minBelowPhotos for the below zone
  const maxFromReserve = totalNonHeroCount - tuning.minBelowPhotos;
  
  return Math.max(0, Math.min(maxFromFraction, maxFromReserve));
}

/**
 * Get row modes to try, ordered by preference based on optimal calculation.
 * 
 * Returns modes closest to optimal first, allowing graceful fallback.
 */
export function getPreferredRowModes(optimalRows: number): (1 | 2 | 3)[] {
  if (optimalRows <= 1.5) return [1, 2, 3];
  if (optimalRows >= 2.5) return [3, 2, 1];
  return [2, 1, 3]; // optimal around 2
}

/**
 * Calculate aspect contrast between hero and beside photos.
 * 
 * Returns ratio > 1 when hero is wider than beside photos (landscape hero + portrait beside).
 * Returns ratio < 1 when hero is taller than beside photos (portrait hero + landscape beside).
 */
export function calculateAspectContrast(
  heroAspect: number,
  besidePhotos: PhotoDimension[]
): number {
  if (besidePhotos.length === 0) return 1.0;
  const avgBesideAR = mean(besidePhotos.map(p => p.aspectRatio));
  return heroAspect / avgBesideAR;
}
```

---

## Changes to Existing Files

### `src/lib/heroLayout.ts`

**Remove:**
- Local `PhotoDimension` interface (lines 28-34)
- Local `shuffleArray` function (lines 40-47)
- Local `getPhotoDimensions` function (lines 49-62)

**Add import:**
```typescript
import { 
  PhotoDimension, 
  shuffleArray, 
  getPhotoDimensions,
  calculateOptimalBesideRowCount,
  calculateMaxBesideCount,
  getPreferredRowModes,
} from '@/lib/layoutMath';
```

**Keep:**
- `calculateOptimalHeroFraction` (hero-specific algebra)
- `packBesideAs2Rows`, `packBesideAs3Rows` (packing primitives)
- `generateEdgeAnchoredHeroLayout` (hero layout orchestration)
- Row alignment fixers

### `src/lib/collageLayout.ts`

**Remove:**
- Local `PhotoDimension` interface (lines 10-16)
- Local `shuffleArray` function (lines 222-229)
- Local `getPhotoDimensions` function (lines 243-256)
- Local `coefficientOfVariation` function (lines 263-269)

**Add import:**
```typescript
import { 
  PhotoDimension, 
  shuffleArray, 
  getPhotoDimensions,
  coefficientOfVariation,
} from '@/lib/layoutMath';
```

**Keep:**
- Scoring functions (`scoreConfiguration`, `calculateDirectionPenalty`)
- Region packing (`packPhotosIntoRegion`)
- Shape bounds (`getAspectBounds`, `isAspectAcceptable`)

### `src/lib/layoutBlocks.ts`

**Remove:**
- Local `PhotoDimension` interface (lines 25-31)

**Add import:**
```typescript
import { PhotoDimension } from '@/lib/layoutMath';
```

### `src/types/collage.ts`

**Add new tuning parameters:**
```typescript
export interface LayoutTuning {
  // ... existing fields ...
  
  // Mathematical structure selection
  baseMaxBesideFraction: number;  // Max % of non-hero photos in beside zone (default 0.40)
  minBelowPhotos: number;         // Reserve this many for below zone (default 3)
  aspectContrastFloor: number;    // Min contrast modifier (default 0.8)
  aspectContrastCap: number;      // Max contrast modifier (default 1.3)
  minHeroProminenceRatio: number; // Hero must be this much bigger than runner-up (default 1.3)
}

export const DEFAULT_TUNING: LayoutTuning = {
  // ... existing values ...
  
  // NEW mathematical parameters
  baseMaxBesideFraction: 0.40,
  minBelowPhotos: 3,
  aspectContrastFloor: 0.8,
  aspectContrastCap: 1.3,
  minHeroProminenceRatio: 1.3,
};
```

---

## Module Dependency Graph

```text
types/collage.ts (types only)
       ↓
lib/cropUtils.ts (getDisplayCrop)
       ↓
lib/layoutMath.ts (pure math, uses cropUtils for getPhotoDimensions)
       ↓
       ├── lib/collageLayout.ts (scoring, region packing)
       ├── lib/heroLayout.ts (hero layout generation)
       └── lib/layoutBlocks.ts (block-based layouts)
```

Each module has a clear responsibility:
- `layoutMath.ts` - Pure math, no layout logic
- `collageLayout.ts` - Scoring and region packing
- `heroLayout.ts` - Hero-specific layout generation
- `layoutBlocks.ts` - Block abstraction layer

---

## Benefits

1. **Single source of truth** - `PhotoDimension` defined once
2. **DRY** - `shuffleArray`, `coefficientOfVariation` defined once
3. **Testable** - Pure functions in `layoutMath.ts` are trivial to unit test
4. **Evolvable** - New math helpers go in one obvious place
5. **Clear dependencies** - No circular imports, clean hierarchy

---

## Implementation Order

1. Create `src/lib/layoutMath.ts` with all shared utilities
2. Update `src/types/collage.ts` with new tuning parameters
3. Update `src/lib/layoutBlocks.ts` to import `PhotoDimension`
4. Update `src/lib/collageLayout.ts` to import shared utilities
5. Update `src/lib/heroLayout.ts` to import shared utilities + use new math
6. Update `src/test/layout/layoutAdapter.ts` to import from `layoutMath`


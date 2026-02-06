

# Fix V3 to Handle Hero-less Collages

## Problem

V3 currently returns `null` immediately when no hero photo is present (line 44-47 of `intersection.ts`). This contradicts the unified block system architecture where "standard layouts are processed as hero layouts with zero hero units."

Looking at console logs, we see the failure pattern:
```
heroCount: 0, contentCount: 20 → "No valid configuration found"
```

## Root Cause

The V3 intersection engine was built with a hero-first decomposition model. When there's no hero, there's no canvas decomposition, no proposals, and no layout - it just bails.

## Solution

Add a **"simple rows" fallback path** in V3 when no hero is present. This is consistent with:
1. V2's approach (always generates `strategySimpleRows` regardless of heroes)
2. The memory about "unified block system" (hero layouts with zero hero units)

## Implementation

### Modify `src/lib/v3/intersection.ts`

**Current flow:**
```
findValidConfiguration()
  → findHeroPhoto() returns null
  → return null (BUG!)
```

**New flow:**
```
findValidConfiguration()
  → findHeroPhoto() returns null
  → NEW: generateSimpleRowsLayout(contentPhotos, canvasWidth, gap, tuning)
  → return ScoredConfiguration with all photos in rows
```

### Changes Required

```typescript
// intersection.ts lines 40-47 - replace the early return

export function findValidConfiguration(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING
): ScoredConfiguration | null {
  const heroPhoto = findHeroPhoto(photos);
  const contentPhotos = getContentPhotos(photos);
  
  // NEW: If no hero, generate simple rows layout
  if (!heroPhoto) {
    return generateSimpleRowsLayout(photos, canvasWidth, gap, tuning);
  }
  
  // ... rest of hero-based logic
}
```

### Add new function `generateSimpleRowsLayout`

```typescript
/**
 * Generate a layout with no hero - all photos in rows.
 * Used when no hero photo is designated.
 */
function generateSimpleRowsLayout(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  tuning: V3Tuning
): ScoredConfiguration | null {
  if (photos.length === 0) {
    return null;
  }
  
  // Create a region spanning the full canvas width
  const region: RegionSpec = {
    x: 0,
    y: 0,
    width: canvasWidth,
    height: Infinity, // Will be determined by packing
  };
  
  // Pack all photos into rows
  const { cells, actualHeight } = packPhotosIntoRegion(
    photos,
    region,
    gap,
    tuning
  );
  
  if (cells.length === 0) {
    return null;
  }
  
  // Create a "dummy" proposal for consistency with ScoredConfiguration type
  const dummyProposal: HeroProposal = {
    rect: { x: 0, y: 0, width: 0, height: 0 },
    mode: 'corner',
    position: 'top-left',
  };
  
  // Score based on area uniformity (no hero prominence to consider)
  const areas = cells.map(c => c.width * c.height);
  const areaUniformity = 1 / (1 + coefficientOfVariation(areas));
  
  return {
    proposal: dummyProposal,
    distribution: { assignments: new Map([[0, photos.map(p => p.id)]]), totalAssigned: photos.length },
    cells,
    canvasHeight: actualHeight,
    prominenceRatio: 1, // No hero, so ratio is neutral
    score: areaUniformity, // Simple scoring for hero-less layouts
  };
}
```

### Import needed types

```typescript
import { packPhotosIntoRegion } from './row-pack';
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Add `generateSimpleRowsLayout` function, change early-return logic to call it |

---

## Testing

After this fix:
1. Upload photos without marking any as hero
2. Switch to V3 in debug panel
3. Should see a valid row-based layout instead of "No valid configuration found"


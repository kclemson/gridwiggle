

# Fix: Hero Layout Region Overlap Bug

## Root Cause Identified

The hero is being placed correctly, but **standard photos are overlapping on top of it** because the region packing doesn't respect height boundaries.

### The Problem

When `packPhotosIntoRegion` is called for each remaining region:

```typescript
const largerPacked = packPhotosIntoRegion(largerStandards, {
  width: larger.width,
  gap,
  offsetX: larger.x,
  offsetY: larger.y,
  isLandscape: largerIsWide,
});
```

**No height constraint is passed.** The packer creates rows and extends vertically as needed, completely ignoring the region's actual height. This causes cells to be placed beyond the region boundary and overlap the hero.

### Visual Example

```text
Canvas: 1200 x 800
Hero at bottom-right: (600, 400) size 600x400

Regions calculated:
  Left strip: (0, 0) → (592, 800)     ← Full height
  Top strip:  (600, 0) → (1200, 392)  ← Partial height!

What happens:
  Left strip packs 15 photos → achieves 900px height ← OVERFLOWS!
  Top strip packs 8 photos → achieves 500px height  ← OVERLAPS HERO!
```

## Solution: Constrain Packing to Region Height

### Approach A: Pass Region Height as Constraint (Recommended)

Modify the packing calls to include `targetHeight` so the packer can:
1. Choose row configurations that fit within the height
2. Scale photos to fill the region without exceeding it

```typescript
const largerPacked = packPhotosIntoRegion(largerStandards, {
  width: larger.width,
  gap,
  offsetX: larger.x,
  offsetY: larger.y,
  isLandscape: largerIsWide,
  targetHeight: larger.height,  // <-- ADD THIS
});
```

### Approach B: Scale Final Cells to Fit

If the achieved height exceeds the region height, scale all cells proportionally to fit within the region bounds.

## Technical Changes

### File: `src/lib/heroLayout.ts`

#### Update `packLShape` (lines 342-388)

Pass region height to constrain packing:

```typescript
function packLShape(
  standards: PhotoDimension[],
  regions: Region[],
  gap: number
): CollageCell[] {
  const [larger, smaller] = regions;
  const allCells: CollageCell[] = [];
  
  // Determine orientation of each region
  const largerIsWide = larger.width > larger.height;
  const smallerIsWide = smaller.width > smaller.height;
  
  // ... distribution logic stays same ...
  
  // Pack larger region - CONSTRAIN TO REGION HEIGHT
  const largerPacked = packPhotosIntoRegion(largerStandards, {
    width: larger.width,
    gap,
    offsetX: larger.x,
    offsetY: larger.y,
    isLandscape: largerIsWide,
    targetHeight: larger.height,  // ADD: constrain to region
  });
  
  // Scale cells if packing exceeded region bounds
  const scaledLargerCells = scaleToFitRegion(largerPacked.cells, larger);
  allCells.push(...scaledLargerCells);
  
  // Pack smaller region - CONSTRAIN TO REGION HEIGHT
  if (smallerStandards.length > 0) {
    const smallerPacked = packPhotosIntoRegion(smallerStandards, {
      width: smaller.width,
      gap,
      offsetX: smaller.x,
      offsetY: smaller.y,
      isLandscape: smallerIsWide,
      targetHeight: smaller.height,  // ADD: constrain to region
    });
    
    const scaledSmallerCells = scaleToFitRegion(smallerPacked.cells, smaller);
    allCells.push(...scaledSmallerCells);
  }
  
  return allCells;
}
```

#### Add `scaleToFitRegion` helper

```typescript
/**
 * If cells exceed region bounds, scale them proportionally to fit.
 * This ensures no overlap with hero or other regions.
 */
function scaleToFitRegion(cells: CollageCell[], region: Region): CollageCell[] {
  if (cells.length === 0) return cells;
  
  // Find actual bounds of packed cells (relative to region)
  const minX = Math.min(...cells.map(c => c.x));
  const minY = Math.min(...cells.map(c => c.y));
  const maxX = Math.max(...cells.map(c => c.x + c.width));
  const maxY = Math.max(...cells.map(c => c.y + c.height));
  
  const packedWidth = maxX - minX;
  const packedHeight = maxY - minY;
  
  // If within bounds, no scaling needed
  if (packedHeight <= region.height && packedWidth <= region.width) {
    return cells;
  }
  
  // Calculate scale factor to fit (maintain aspect ratio)
  const scaleX = region.width / packedWidth;
  const scaleY = region.height / packedHeight;
  const scale = Math.min(scaleX, scaleY);
  
  // Scale and re-position cells within region
  return cells.map(cell => ({
    photoId: cell.photoId,
    x: Math.round(region.x + (cell.x - minX) * scale),
    y: Math.round(region.y + (cell.y - minY) * scale),
    width: Math.round(cell.width * scale),
    height: Math.round(cell.height * scale),
  }));
}
```

#### Update `packMultipleRegions` (lines 390-430)

Apply same pattern for 3+ region cases:

```typescript
function packMultipleRegions(
  standards: PhotoDimension[],
  sortedRegions: Region[],
  gap: number
): CollageCell[] {
  // ... existing distribution logic ...
  
  for (let i = 0; i < sortedRegions.length; i++) {
    const region = sortedRegions[i];
    // ... existing logic to get regionStandards ...
    
    const packed = packPhotosIntoRegion(regionStandards, {
      width: region.width,
      gap,
      offsetX: region.x,
      offsetY: region.y,
      isLandscape: region.width > region.height,
      targetHeight: region.height,  // ADD: constrain to region
    });
    
    // Scale to fit if needed
    const scaledCells = scaleToFitRegion(packed.cells, region);
    allCells.push(...scaledCells);
  }
  
  return allCells;
}
```

## Why This Works

1. **Packing provides a hint** via `targetHeight` for the row-split algorithm to prefer configurations closer to the target
2. **Scaling as fallback** ensures that even if the packer can't perfectly match the target, cells are scaled to fit within region bounds
3. **No overlap possible** because each region's cells are guaranteed to stay within that region's bounds

## Expected Results

- Hero photos remain visible and unobstructed
- Standard photos fill their designated regions without overflow
- L-shaped remaining areas pack cleanly without gaps or overlaps
- Layout maintains visual coherence with proper spacing


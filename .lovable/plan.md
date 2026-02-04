

# Fix Hero Layout Bugs: Region Packing & Aspect Ratio

## Two Bugs to Fix

### Bug 1: Disjointed Standard Photo Packing
**Problem**: When hero is in a corner (creating an L-shaped remaining area), standards are distributed across 2 separate regions and packed independently, causing visual gaps and disjointed layout.

**Root Cause**: `packStandardsIntoRegions` distributes photos proportionally and packs each region separately with `packPhotosIntoRegion`, ignoring that these regions form a connected L-shape.

**Solution**: Merge adjacent regions into a unified packing strategy. For L-shaped remaining space, pack all standards together and intelligently fill both the vertical and horizontal strips.

### Bug 2: Hero Photo Cropped Incorrectly
**Problem**: The hero photo in the second screenshot is visibly cropped/distorted - it's not showing the correct aspect ratio.

**Root Cause**: The cell dimensions created by `calculateHeroDimensions` use `Math.round()` on both width and height independently, which can break the precise aspect ratio. When `CroppedImage` renders with `fit="cover"`, any mismatch causes additional cropping.

**Solution**: Ensure cell dimensions maintain exact aspect ratio by rounding one dimension and computing the other from it.

---

## Technical Changes

### File: `src/lib/heroLayout.ts`

### Fix 1: Aspect-Preserving Rounding

**Current Problem** (lines 124-128):
```typescript
return { 
  x: Math.round(x), 
  y: Math.round(y), 
  width: Math.round(width),   // Rounded independently
  height: Math.round(height)  // Rounded independently - breaks ratio!
};
```

**Fixed Version**:
```typescript
// Round width first, then derive height to preserve exact aspect ratio
const roundedWidth = Math.round(width);
const roundedHeight = Math.round(roundedWidth / heroAspect);

return { 
  x: Math.round(x), 
  y: Math.round(y), 
  width: roundedWidth,
  height: roundedHeight
};
```

### Fix 2: Unified L-Shape Packing

Replace `packStandardsIntoRegions` with smarter logic that:

1. **Identifies region shape**: Corner (2 regions forming L), Edge (3 regions), or Floating (4 regions)
2. **For L-shapes**: Merge into unified packing - fill the longer strip first, then fill the shorter strip with remaining photos
3. **For complex shapes**: Keep proportional distribution but ensure no gaps

**Approach**:
```typescript
function packStandardsIntoRegions(
  standards: PhotoDimension[],
  regions: Region[],
  gap: number
): CollageCell[] {
  if (standards.length === 0 || regions.length === 0) {
    return [];
  }
  
  // Sort by area (largest first)
  const sortedRegions = [...regions].sort((a, b) => 
    (b.width * b.height) - (a.width * a.height)
  );
  
  // For 2 regions (L-shape from corner hero):
  // Pack more photos into the larger region, fewer into smaller
  // Use region dimensions to determine how many photos fit well
  
  if (sortedRegions.length === 2) {
    return packLShape(standards, sortedRegions, gap);
  }
  
  // For 3+ regions, use existing proportional approach
  // but improved to avoid orphan photos
  return packMultipleRegions(standards, sortedRegions, gap);
}

function packLShape(
  standards: PhotoDimension[],
  regions: Region[],  // Exactly 2 regions
  gap: number
): CollageCell[] {
  const [larger, smaller] = regions;
  const allCells: CollageCell[] = [];
  
  // Determine orientation of each region
  const largerIsWide = larger.width > larger.height;
  const smallerIsWide = smaller.width > smaller.height;
  
  // Calculate how many standards fit well in each region
  // based on region dimensions and average photo aspect
  const avgAspect = standards.reduce((s, p) => s + p.aspectRatio, 0) / standards.length;
  
  // Estimate photos per region based on area ratio
  const totalArea = larger.width * larger.height + smaller.width * smaller.height;
  const largerProportion = (larger.width * larger.height) / totalArea;
  
  // Distribute photos, ensuring each region gets at least 1 if possible
  let largerCount = Math.round(standards.length * largerProportion);
  largerCount = Math.max(1, Math.min(largerCount, standards.length - 1));
  
  const largerStandards = standards.slice(0, largerCount);
  const smallerStandards = standards.slice(largerCount);
  
  // Pack larger region
  const largerPacked = packPhotosIntoRegion(largerStandards, {
    width: larger.width,
    gap,
    offsetX: larger.x,
    offsetY: larger.y,
    isLandscape: largerIsWide,
  });
  allCells.push(...largerPacked.cells);
  
  // Pack smaller region
  if (smallerStandards.length > 0) {
    const smallerPacked = packPhotosIntoRegion(smallerStandards, {
      width: smaller.width,
      gap,
      offsetX: smaller.x,
      offsetY: smaller.y,
      isLandscape: smallerIsWide,
    });
    allCells.push(...smallerPacked.cells);
  }
  
  return allCells;
}
```

### Fix 3: Handle Edge Cases in Region Distribution

The current code has a bug where remaining standards after proportional distribution are placed with incorrect Y offset:

```typescript
// Current (buggy):
const maxUsedY = regionCells.length > 0 
  ? Math.max(...regionCells.map(c => c.y + c.height)) + gap
  : region.y;
```

This finds max Y across ALL cells that happen to overlap with the region's X range, which may include cells from other regions. Should track per-region usage explicitly.

---

## Summary of Changes

| File | Function | Change |
|------|----------|--------|
| `heroLayout.ts` | `calculateHeroDimensions` | Round width first, derive height to preserve aspect |
| `heroLayout.ts` | `packStandardsIntoRegions` | Add L-shape detection and unified packing |
| `heroLayout.ts` | New `packLShape` | Handle 2-region L-shape cases specially |

## Expected Results

1. **Hero photos** will display without additional cropping - cell aspect exactly matches crop aspect
2. **L-shaped remaining areas** (from corner heroes) will pack standards more cohesively
3. **No visual gaps** between packed regions


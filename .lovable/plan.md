

## Safe Refactoring: Extract Reusable Region Packer

Extract the existing row-packing logic into a reusable `packPhotosIntoRegion` function **without changing any behavior**. The current `generateCollageLayout` will continue to work exactly as it does now, just calling the new shared primitive internally.

### What We're Extracting

The current flow is:
```text
generateCollageLayout
  → getPhotoDimensions (extract aspect ratios)
  → findBestRowSplit (partition photos into rows)
  → calculateLayout (convert rows to cells)
```

The new flow will be:
```text
generateCollageLayout
  → getPhotoDimensions
  → packPhotosIntoRegion (wraps findBestRowSplit + calculateLayout)
      ↳ Returns cells + achieved height + validity info
```

### New Types

```typescript
interface RegionPackResult {
  /** Cells positioned within the region */
  cells: CollageCell[];
  
  /** The height the packing achieved */
  achievedHeight: number;
  
  /** The row partition used */
  partition: PhotoDimension[][];
  
  /** If targetHeight was provided: whether achieved is within tolerance */
  valid: boolean;
  
  /** Absolute difference from target height (0 if no target) */
  heightError: number;
}

interface RegionPackOptions {
  /** Region width (required) */
  width: number;
  
  /** Gap between photos */
  gap: number;
  
  /** Target height to validate against (optional) */
  targetHeight?: number;
  
  /** Tolerance for height matching (default: 2px) */
  tolerance?: number;
  
  /** Offset for cell positions (default: 0, 0) */
  offsetX?: number;
  offsetY?: number;
  
  /** Target aspect ratio for scoring (optional, inferred from width/targetHeight) */
  targetAspect?: number;
  
  /** Whether this is a landscape-oriented region */
  isLandscape?: boolean;
}
```

### Implementation Strategy

**Step 1: Create `packPhotosIntoRegion` function**

This wraps the existing logic:

```typescript
function packPhotosIntoRegion(
  dims: PhotoDimension[],
  options: RegionPackOptions
): RegionPackResult {
  const { 
    width, 
    gap, 
    targetHeight, 
    tolerance = 2,
    offsetX = 0,
    offsetY = 0,
    targetAspect,
    isLandscape = true 
  } = options;
  
  // Handle empty/single photo cases
  if (dims.length === 0) {
    return { cells: [], achievedHeight: 0, partition: [], valid: true, heightError: 0 };
  }
  
  if (dims.length === 1) {
    const d = dims[0];
    const cellHeight = width / d.aspectRatio;
    const cells: CollageCell[] = [{
      photoId: d.id,
      x: Math.round(offsetX),
      y: Math.round(offsetY),
      width: Math.round(width),
      height: Math.round(cellHeight),
    }];
    const heightError = targetHeight ? Math.abs(cellHeight - targetHeight) : 0;
    return { 
      cells, 
      achievedHeight: cellHeight, 
      partition: [[d]], 
      valid: !targetHeight || heightError <= tolerance,
      heightError 
    };
  }
  
  // Use existing row-split logic
  const effectiveTargetAspect = targetAspect ?? (targetHeight ? width / targetHeight : (isLandscape ? 1.5 : 0.75));
  const partition = findBestRowSplit(dims, effectiveTargetAspect, isLandscape);
  
  // Calculate layout (reuse existing function but with offsets)
  const cells = calculateLayoutWithOffset(partition, width, gap, offsetX, offsetY);
  const achievedHeight = calculatePackedHeight(partition, width, gap);
  
  const heightError = targetHeight ? Math.abs(achievedHeight - targetHeight) : 0;
  const valid = !targetHeight || heightError <= tolerance;
  
  return { cells, achievedHeight, partition, valid, heightError };
}
```

**Step 2: Extract `calculateLayoutWithOffset`**

A variant of `calculateLayout` that takes offset parameters:

```typescript
function calculateLayoutWithOffset(
  rows: PhotoDimension[][],
  width: number,
  gap: number,
  offsetX: number,
  offsetY: number
): CollageCell[] {
  const cells: CollageCell[] = [];
  
  let y = offsetY;
  for (const row of rows) {
    const aspectSum = getRowAspectSum(row);
    const availableWidth = width - gap * (row.length - 1);
    const height = availableWidth / aspectSum;
    
    let x = offsetX;
    for (const photo of row) {
      const photoWidth = (photo.aspectRatio * photo.weight / aspectSum) * availableWidth;
      
      cells.push({
        photoId: photo.id,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(photoWidth),
        height: Math.round(height),
      });
      
      x += photoWidth + gap;
    }
    
    y += height + gap;
  }
  
  return cells;
}
```

**Step 3: Add `calculatePackedHeight` helper**

```typescript
function calculatePackedHeight(
  partition: PhotoDimension[][],
  width: number,
  gap: number
): number {
  const heights = partition.map(row => {
    const aspectSum = getRowAspectSum(row);
    const availableWidth = width - gap * (row.length - 1);
    return availableWidth / aspectSum;
  });
  return heights.reduce((sum, h) => sum + h, 0) + gap * (partition.length - 1);
}
```

**Step 4: Refactor `calculateLayout` to use shared code**

The existing `calculateLayout` becomes a thin wrapper:

```typescript
function calculateLayout(
  rows: PhotoDimension[][],
  settings: CollageSettings,
  baseWidth: number = 1200
): CollageLayout {
  const cells = calculateLayoutWithOffset(rows, baseWidth, settings.gapSize, 0, 0);
  const totalHeight = calculatePackedHeight(rows, baseWidth, settings.gapSize);
  
  return {
    width: baseWidth,
    height: totalHeight,
    cells,
  };
}
```

**Step 5: Verify `generateCollageLayout` still works identically**

No changes to its logic - it continues to call `findBestRowSplit` + `calculateLayout` exactly as before.

### File Changes

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Add `RegionPackResult` and `RegionPackOptions` types, add `packPhotosIntoRegion`, `calculateLayoutWithOffset`, `calculatePackedHeight` functions, refactor `calculateLayout` to use shared helpers |

### What Stays Exactly The Same

- `generateCollageLayout` public API and behavior
- `swapPhotosInLayout` unchanged
- `findBestRowSplit` logic unchanged  
- `scorePartition` logic unchanged
- All partition generation logic unchanged

### What's New (Additive Only)

- `packPhotosIntoRegion` - new exported function for future hero layouts
- `calculateLayoutWithOffset` - internal helper
- `calculatePackedHeight` - internal helper
- `RegionPackResult` and `RegionPackOptions` types

### Testing Checklist

After this refactor, verify:
1. Create a new collage with 3-5 photos - layout looks identical
2. Toggle landscape/portrait - behavior unchanged
3. Change gap size - cells reposition correctly
4. Drag to swap photos - works as before
5. Toggle hero on a photo - layout regenerates (existing weight-based behavior)
6. Add more photos - row distribution unchanged
7. Remove photos - layout adapts correctly

### Technical Notes

- The refactoring is purely structural - no algorithm changes
- `packPhotosIntoRegion` is exported for future use by hero layout code
- The `targetHeight` validation enables future hero layouts to check if a region can be filled exactly
- Offset parameters enable positioning cells within sub-regions of the collage


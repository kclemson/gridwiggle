
# Fix Hero Layout: Root Cause Analysis and Solution

## Problems Identified

### Problem 1: Photo Clipping (Critical)

**Root Cause**: The `packVerticalStrip` function scales cell heights to match the hero's height, but keeps cell widths unchanged. This breaks the photo's aspect ratio.

```typescript
// Current code (lines 304-309)
return cells.map(cell => ({
  photoId: cell.photoId,
  x: cell.x,
  y: Math.round(offsetY + (cell.y - minY) * scale),
  width: cell.width,        // ← Width unchanged
  height: Math.round(cell.height * scale),  // ← Height scaled
}));
```

When a cell's aspect ratio differs from the photo's crop aspect ratio, `CroppedImage` with `fit="cover"` clips parts of the photo to fill the mismatched cell.

**Example**: 
- Photo crop: 400x300 (4:3 aspect = 1.33)
- Cell after scaling: 400x200 (4:2 aspect = 2.0)
- Result: Top and bottom of photo get clipped to fit the wider cell

### Problem 2: Portrait Bias with Auto Orientation

**Root Cause**: The zone-based layout stacks content vertically by design:
1. Above zone (full-width rows)
2. Hero zone with side strips  
3. Below zone (full-width rows)

This vertical stacking naturally creates tall layouts regardless of the `targetAspect`. The algorithm doesn't constrain total height to match the target aspect ratio.

### Problem 3: Few Photos + Floating Hero = Blank Rectangles

With only 5 standard photos and 1 hero:
- Zone distribution might put 1-2 photos in each zone
- Side strips with 1-2 photos can't fill the hero's full height without extreme distortion
- Result: Gaps or heavy clipping

---

## Solution

### Fix 1: Uniform Scaling (Preserves Aspect Ratios)

When scaling cells to match target height, scale **both width and height** uniformly:

```typescript
function packVerticalStrip(
  photos: PhotoDimension[],
  stripWidth: number,
  targetHeight: number,
  offsetX: number,
  offsetY: number,
  gap: number
): CollageCell[] {
  if (photos.length === 0 || stripWidth < MIN_DIMENSION) return [];
  
  const result = packPhotosIntoRegion(photos, {
    width: stripWidth,
    gap,
    offsetX,
    offsetY,
    isLandscape: false,
    targetHeight,
  });
  
  const cells = result.cells;
  if (cells.length === 0) return [];
  
  const packedHeight = getCellsHeight(cells);
  
  // If significantly off from target, scale UNIFORMLY
  if (Math.abs(packedHeight - targetHeight) > gap) {
    const scale = targetHeight / packedHeight;
    const minY = Math.min(...cells.map(c => c.y));
    const minX = Math.min(...cells.map(c => c.x));
    
    return cells.map(cell => ({
      photoId: cell.photoId,
      // Scale width too to preserve aspect ratio
      x: Math.round(offsetX + (cell.x - minX) * scale),
      y: Math.round(offsetY + (cell.y - minY) * scale),
      width: Math.round(cell.width * scale),
      height: Math.round(cell.height * scale),
    }));
  }
  
  return cells;
}
```

**However**, this creates a new problem: The scaled strip will be **narrower** than the allocated width, creating gaps.

### Fix 2: Fundamental Algorithm Change - Constrained Column Packing

The real solution is to make the side strips work like the row packing does - where the cells fill their region **exactly** without scaling.

**Key insight**: Row packing works because:
- Width is fixed → heights adjust naturally
- Each photo's height = width / aspectRatio
- Total height is whatever it needs to be

For vertical strips beside the hero, we need the inverse:
- Height is fixed (match hero)
- Widths adjust naturally
- Total width is whatever it needs to be

But we can't have "whatever width" - we have a specific strip width. This is the constraint conflict.

### Fix 3: Adaptive Strategy Based on Photo Count

Introduce constraints based on photo count:

| Photo Count | Strategy |
|-------------|----------|
| < 8 standards | Anchor hero to edge (left or right), no side strips on the anchored side |
| 8-15 standards | Allow center positioning but prefer edge anchors |
| > 15 standards | Full flexibility including floating center |

This reduces the number of zones that need filling when there aren't enough photos.

### Fix 4: Hero Size Constraints by Photo Count

Limit hero size based on available standards:

```typescript
function calculateHeroSize(hero, canvasWidth, canvasHeight, heroCount, standardCount) {
  // Reduce hero budget when few standards available
  let maxBudget = standardCount < 5 ? 0.35 : 
                  standardCount < 10 ? 0.45 : 
                  0.60;
  
  const perHeroBudget = Math.min(maxBudget / heroCount, ...);
  // ...rest of calculation
}
```

### Fix 5: Zone-Based Width Allocation Instead of Height Scaling

Instead of packing into a strip and then scaling height (which breaks aspect ratios), calculate how much width the side photos **actually need** to fill the hero's height naturally:

```typescript
function calculateStripWidth(
  photos: PhotoDimension[],
  targetHeight: number,
  gap: number
): number {
  // Given these photos need to stack vertically to exactly targetHeight,
  // what width would let them do that with correct aspect ratios?
  
  // For a single column: sum of (width/aspect) = targetHeight
  // So: width * sum(1/aspect) = targetHeight  
  // width = targetHeight / sum(1/aspect)
  
  const inverseAspectSum = photos.reduce((sum, p) => sum + 1/p.aspectRatio, 0);
  const gapTotal = gap * (photos.length - 1);
  const photoHeightTotal = targetHeight - gapTotal;
  
  return photoHeightTotal / inverseAspectSum;
}
```

Then use this calculated width for the strip, adjusting the hero's X position to accommodate.

---

## Recommended Approach: Simplified Edge-Anchored Layout

Given the complexity of making floating heroes work with all photo counts, implement a simpler approach for the first iteration:

1. **Always anchor hero to an edge** (left or right)
2. **Two zones only**: Hero-level (single column beside hero) + Below (full-width rows)
3. **No height scaling** - pack the beside column at natural width, hero adjusts position
4. **Automatic hero sizing** based on standard count

This eliminates the blank rectangle problem entirely because:
- No "above" zone splitting
- Only one side strip (not two)
- Below zone can absorb any number of remaining photos

---

## Implementation Plan

### Phase 1: Fix the Clipping (Immediate)
- Remove the height-only scaling in `packVerticalStrip`
- Either scale uniformly (accepting narrower strips) or remove scaling entirely

### Phase 2: Simplify Hero Positioning
- Anchor hero to left or right edge
- Single side strip beside hero (not both sides)
- All remaining photos go to "below" zone

### Phase 3: Add Photo-Count Awareness
- Adjust hero size budget based on standard count
- Larger hero only when many standards available to fill remaining space

---

## Technical Changes Summary

| File | Function | Change |
|------|----------|--------|
| `heroLayout.ts` | `packVerticalStrip` | Remove height-only scaling (causes clipping) |
| `heroLayout.ts` | `chooseHeroX` | Bias toward edge positions (0 or rightX) |
| `heroLayout.ts` | `calculateHeroSize` | Scale budget by standard count |
| `heroLayout.ts` | `generateSingleHeroLayout` | Simplify to 2 zones: beside + below |

## Expected Results

1. **No clipping** - All cells match their photos' aspect ratios exactly
2. **No blank rectangles** - Simplified zone structure fills naturally
3. **Better orientation matching** - Reduced vertical stacking improves aspect adherence
4. **Works with few photos** - Edge-anchored hero doesn't create unfillable regions

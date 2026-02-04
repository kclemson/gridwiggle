
# Fix Hero Layout: Eliminate Blank Rectangles and Square Bias

## Problem Analysis

From the screenshots and code review, I identified three root causes:

### 1. Blank Rectangles: Inconsistent Scaling

In `generateEdgeAnchoredHeroLayout`, there are TWO different scale factors applied:

```typescript
// Scale factor for hero height
const scaleFactor = canvasWidth / totalNaturalWidth;

// DIFFERENT scale factor for beside width
const besideScaleFactor = actualBesideWidth / targetBesideWidth;
```

The beside cells get their X/width scaled by `besideScaleFactor` but Y/height by `scaleFactor`. This creates gaps when the hero's actual width differs from the target.

### 2. Square Aspect Ratio Tendency

The "Auto" mode calculates:
```typescript
const avgAspect = dims.reduce((sum, d) => sum + d.aspectRatio, 0) / dims.length;
```

With mixed portrait/landscape photos, this averages to ~1.0. The scoring then penalizes deviations heavily (`aspectDiff * 2.0`), pulling everything toward square.

### 3. 2-Row Not Happening (Tolerance Too Strict)

The ±10% tolerance check fails when the hero has an extreme aspect ratio, forcing fallback to 1-row mode which causes the "similar size" problem you originally reported.

## Solution

### Fix 1: Unified Scaling (No More Blank Rectangles)

Instead of two scaling factors, use a single consistent approach:

1. **Calculate the beside rows first** (they determine the shared height)
2. **Hero height = beside combined height** (no scaling needed - they match by definition)
3. **Scale the beside WIDTH to fill remaining canvas space** (single axis only)

The key insight: both the hero and beside rows share the SAME height by construction. We only need to scale widths to fill the canvas.

```typescript
// Hero and beside share the same height (by construction)
const sharedHeight = combinedBesideHeight;
const heroWidth = sharedHeight * hero.aspectRatio;

// Calculate remaining width for beside
const besideWidth = canvasWidth - heroWidth - gap;

// Scale beside cells horizontally only to fit besideWidth
const horizontalScale = besideWidth / originalBesideWidth;
```

### Fix 2: Auto Mode Should Let Height Emerge (Remove Square Bias)

For "Auto" mode with heroes, DON'T calculate a target aspect ratio. Let the layout emerge naturally:

1. Pack beside photos into 2 rows at a reasonable width
2. Hero height = combined height
3. Final collage aspect = canvasWidth / totalHeight

This removes the square bias because there's no target to pull toward.

### Fix 3: Relaxed Tolerance with Iterative Approach

Instead of failing when outside ±10%, try different beside photo counts:

```typescript
// Try 6 photos beside, then 5, then 4...
for (let count = 6; count >= 2; count--) {
  const result = tryPackBeside(count);
  if (result.withinTolerance) return result;
}
// Only fallback to 1-row if ALL attempts fail
```

This gives more flexibility to find a working 2-row configuration.

## Technical Changes

### File: src/lib/heroLayout.ts

| Function | Change |
|----------|--------|
| `packBesideAs2Rows` | Return both the cells AND the original width so caller can scale correctly |
| `generateEdgeAnchoredHeroLayout` | Use single-axis scaling (width only) for beside cells; height matches hero exactly |
| `generateEdgeAnchoredHeroLayout` | Iterate through beside photo counts (6, 5, 4, 3, 2) to find working 2-row config |
| `generateFloatingHeroLayout` | Same fixes for left/right zones |

### File: src/lib/collageLayout.ts

| Function | Change |
|----------|--------|
| `generateCollageLayout` | For Auto mode with heroes, pass `undefined` as targetAspect |

## Implementation Details

### New `packBesideAs2Rows` Return Value

```typescript
function packBesideAs2Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number
): { 
  cells: CollageCell[];
  combinedHeight: number;
  naturalTotalWidth: number; // NEW: actual width before any scaling
  usedIds: Set<string>;
}
```

### Fixed `generateEdgeAnchoredHeroLayout` Scaling

```typescript
// 1. Pack beside photos first (their height is the reference)
const { cells: rawBesideCells, combinedHeight, naturalBesideWidth } = 
  packBesideAs2Rows(besidePhotos, estimatedBesideWidth, gap);

// 2. Hero matches the combined height exactly
const heroHeight = combinedHeight;
const heroWidth = heroHeight * hero.aspectRatio;

// 3. Calculate remaining width for beside zone
const availableBesideWidth = canvasWidth - heroWidth - gap;

// 4. Scale beside cells HORIZONTALLY ONLY to fit
const horizontalScale = availableBesideWidth / naturalBesideWidth;

// 5. Apply to cells (X and width only - height unchanged!)
const scaledBesideCells = rawBesideCells.map(cell => ({
  ...cell,
  x: besideOffsetX + Math.round(cell.x * horizontalScale),
  y: cell.y, // UNCHANGED
  width: Math.round(cell.width * horizontalScale),
  height: cell.height, // UNCHANGED - same as hero sections
}));
```

This guarantees no vertical gaps because:
- Row 1 height + gap + Row 2 height = heroHeight (by construction)
- Cells are only scaled horizontally to fill width
- Hero height matches exactly

### Iterative Beside Photo Count

```typescript
// Try different beside counts to find one that works
for (let besideCount = Math.min(6, standards.length); besideCount >= 2; besideCount--) {
  const besidePhotos = shuffled.slice(0, besideCount);
  const result = packBesideAs2Rows(besidePhotos, targetBesideWidth, gap);
  
  if (result.combinedHeight === 0) continue;
  
  const heroWidth = result.combinedHeight * hero.aspectRatio;
  const totalWidth = heroWidth + gap + result.naturalBesideWidth;
  const scale = canvasWidth / totalWidth;
  
  if (scale >= 0.85 && scale <= 1.15) { // Slightly relaxed tolerance
    // Use this configuration
    break;
  }
}
```

## Expected Results

1. **No blank rectangles** - Hero and beside zones share exact height by construction; only width is scaled
2. **Correct 2-row hierarchy** - Hero is always 2× the height of adjacent photos
3. **Natural Auto orientation** - Height emerges from packing math, not forced toward square
4. **More successful 2-row layouts** - Iterative approach finds working configurations more often


# V3 Architecture Refactor: Normalized Space Layout

## Summary

Refactor the V3 layout engine to work in **normalized AR space** first, then scale to pixels at the end. This eliminates the 55-80% hero width constraint and makes BESIDE a true row-packing problem rather than a "leftover space" problem.

---

## Design Intent

**What problem are we solving?**  
The current code treats BESIDE as leftover space from a fixed hero width. This causes:
- Blank gaps when photos can't fill the fixed height
- `scaleToFillHeight` hacks that create visual artifacts
- Arbitrary 55-80% constraint that doesn't adapt to photo geometry

**What will users experience?**  
- No more blank gaps below BESIDE photos
- More balanced layouts where hero and BESIDE regions naturally complement each other
- Better prominence because the layout is derived from geometry, not forced into fixed boxes

---

## The Math

### Normalized Space

Work in a coordinate system where **hero height = 1**:

```text
Hero: width = heroAR (e.g., 1.7), height = 1
BESIDE: width = W_beside (derived), height = 1
BELOW: width = heroAR + gap + W_beside, height = H_below (derived)
```

### BESIDE Width Calculation

For photos with ARs [a₁, a₂, ...] packed into R rows at height 1:

```text
rowHeight = 1 / R (ignoring gaps for simplicity)
Each photo width at that height = aᵢ × rowHeight
Row total width = sum of photo widths in that row
W_beside = max row width
```

### Scaling to Pixels

Once the normalized layout is complete:

```text
scaleFactor = canvasWidth / (heroWidth + gap_normalized + W_beside)
All dimensions × scaleFactor → pixel dimensions
```

### Constraints Checked After Scaling

```text
canvasAR = canvasWidth / canvasHeight
Reject if canvasAR < canvas_minAR or > canvas_maxAR

heroArea / largestContentArea >= hero_minProminence
```

---

## Architecture Changes

### New Flow

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Parse photos → hero (AR only) + content pool             │
├─────────────────────────────────────────────────────────────┤
│ 2. Pack BESIDE in normalized space (height = 1)             │
│    → Output: W_beside, placed cells (normalized)            │
├─────────────────────────────────────────────────────────────┤
│ 3. Calculate hero row width: W_total = heroAR + gap + W_beside │
├─────────────────────────────────────────────────────────────┤
│ 4. Pack BELOW in normalized space (width = W_total)         │
│    → Output: H_below, placed cells (normalized)             │
├─────────────────────────────────────────────────────────────┤
│ 5. Calculate total canvas: W_total × (1 + gap + H_below)    │
├─────────────────────────────────────────────────────────────┤
│ 6. Scale to pixels: factor = canvasWidth / W_total          │
│    → All cells × factor                                      │
├─────────────────────────────────────────────────────────────┤
│ 7. Validate constraints (canvas AR, prominence)             │
│    → Reject invalid configurations                           │
└─────────────────────────────────────────────────────────────┘
```

---

## File Changes

### 1. `src/lib/v3/types.ts` — Add Normalized Layout Types

Add types for working in normalized space:

```typescript
/** A region in normalized space (hero height = 1) */
export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;  // In AR units, not pixels
  height: number; // Relative to hero height (1.0)
}

/** A cell in normalized space */
export interface NormalizedCell extends NormalizedRegion {
  photoId: string;
}

/** Result of packing in normalized space */
export interface NormalizedPackResult {
  cells: NormalizedCell[];
  width: number;   // Total width used (in AR units)
  height: number;  // Total height used (relative to hero = 1)
}
```

### 2. `src/lib/v3/entities/hero.ts` — Remove Fixed Width Sizing

**Delete**: `computeHeroSize` function (no longer needed)

**Update** `proposePositions` to return **normalized** proposals:

```typescript
export function proposePositions(
  heroPhoto: PhotoDimension,
  contentStats: ContentStats,
  tuning: V3Tuning
): NormalizedHeroProposal[] {
  // Hero dimensions in normalized space
  const heroWidth = heroPhoto.aspectRatio;  // AR = width when height = 1
  const heroHeight = 1.0;
  
  const proposals: NormalizedHeroProposal[] = [];
  
  // Corner placement: hero at origin
  proposals.push({
    rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
    mode: 'corner',
    position: 'top-left',
  });
  
  // Note: x positions like 'top-right' are derived later during scaling
  // because we don't know the total width yet
  
  return proposals;
}
```

### 3. `src/lib/v3/row-pack.ts` — Add Normalized Packing Mode

Add a new function for packing in normalized space:

```typescript
/**
 * Pack photos into rows at a fixed height.
 * Returns the width needed to fit all rows.
 * 
 * @param photos - Photos to pack
 * @param targetHeight - Height to fill (1.0 for BESIDE)
 * @param gap - Gap as fraction of height (e.g., 0.02)
 * @param tuning - Tuning parameters
 * @returns Packed cells and total width used
 */
export function packToFillHeight(
  photos: PhotoDimension[],
  targetHeight: number,
  gap: number,
  tuning: V3Tuning
): NormalizedPackResult {
  // Calculate row count from geometry
  const rowCount = calculateOptimalRowCount(photos, targetHeight, tuning);
  
  // Distribute photos across rows
  const rows = distributeToRowsRoundRobin(photos, rowCount);
  
  // Pack rows and find max width
  let maxRowWidth = 0;
  const cells: NormalizedCell[] = [];
  
  const rowHeight = (targetHeight - (rowCount - 1) * gap) / rowCount;
  let currentY = 0;
  
  rows.forEach(row => {
    // Row width = sum of photo widths at this row height
    const rowWidth = row.reduce((sum, p) => sum + p.aspectRatio * rowHeight, 0)
                    + (row.length - 1) * gap;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
    
    // Place cells left-aligned (will center later if needed)
    let currentX = 0;
    row.forEach(photo => {
      const cellWidth = photo.aspectRatio * rowHeight;
      cells.push({
        photoId: photo.id,
        x: currentX,
        y: currentY,
        width: cellWidth,
        height: rowHeight,
      });
      currentX += cellWidth + gap;
    });
    
    currentY += rowHeight + gap;
  });
  
  return {
    cells,
    width: maxRowWidth,
    height: targetHeight,
  };
}
```

### 4. `src/lib/v3/intersection.ts` — Refactor to Normalized Flow

Rewrite `evaluateProposal` to:

1. Pack BESIDE at normalized height = 1 → get W_beside
2. Calculate W_total = heroAR + gap + W_beside
3. Pack BELOW at normalized width = W_total → get H_below
4. Calculate total normalized canvas
5. Scale to pixel dimensions
6. Validate constraints

```typescript
function evaluateProposal(
  proposal: NormalizedHeroProposal,
  heroPhoto: PhotoDimension,
  contentPhotos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  tuning: V3Tuning
): ScoredConfiguration | null {
  const heroAR = heroPhoto.aspectRatio;
  const normalizedGap = 0.02; // Gap as fraction of hero height
  
  // Step 1: Decide how many photos go to BESIDE vs BELOW
  const splitResult = findBestSplit(contentPhotos, heroAR, normalizedGap, tuning);
  
  // Step 2: Pack BESIDE (height = 1)
  const besideResult = packToFillHeight(
    splitResult.besidePhotos,
    1.0,
    normalizedGap,
    tuning
  );
  
  // Step 3: Calculate hero row width
  const heroRowWidth = heroAR + normalizedGap + besideResult.width;
  
  // Step 4: Pack BELOW (width = heroRowWidth)
  const belowResult = packToFillWidth(
    splitResult.belowPhotos,
    heroRowWidth,
    normalizedGap,
    tuning
  );
  
  // Step 5: Calculate total canvas in normalized space
  const totalNormalizedWidth = heroRowWidth;
  const totalNormalizedHeight = 1.0 + normalizedGap + belowResult.height;
  
  // Step 6: Scale to pixels
  const scaleFactor = canvasWidth / totalNormalizedWidth;
  const pixelGap = gap; // Use actual pixel gap
  
  // Convert all cells to pixels
  const pixelCells = convertToPixels(
    heroPhoto, besideResult.cells, belowResult.cells,
    scaleFactor, pixelGap, proposal.position
  );
  
  // Step 7: Validate constraints
  const canvasHeight = totalNormalizedHeight * scaleFactor;
  const canvasAR = canvasWidth / canvasHeight;
  
  if (canvasAR < tuning.canvas_minAR) {
    // Layout too tall - could try different split
    return null;
  }
  
  // Check prominence
  const heroArea = (heroAR * scaleFactor) * scaleFactor; // heroWidth × heroHeight in pixels
  const contentAreas = pixelCells.slice(1).map(c => c.width * c.height);
  const prominence = validateProminence(heroArea, contentAreas, tuning);
  
  if (!prominence.valid) {
    return null;
  }
  
  // Return valid configuration
  return {
    proposal: proposal,
    distribution: { assignments: new Map(), totalAssigned: contentPhotos.length },
    cells: pixelCells,
    canvasHeight,
    prominenceRatio: prominence.ratio,
    score: scoreConfiguration(prominence.ratio, pixelCells, tuning),
  };
}
```

### 5. `src/lib/v3/entities/canvas.ts` — Simplify Decomposition

Remove pixel-based region calculation. Decomposition now just describes the **topology** (corner, edge, floating), not pixel dimensions:

```typescript
export interface DecompositionTopology {
  mode: DecompositionMode;
  besidePosition: 'left' | 'right';
  belowSpan: 'full-width'; // Always spans full hero row width
}

export function getTopology(mode: DecompositionMode, position: string): DecompositionTopology {
  return {
    mode,
    besidePosition: position.includes('left') ? 'right' : 'left',
    belowSpan: 'full-width',
  };
}
```

### 6. `src/lib/v3/entities/content-pool.ts` — Simplify Distribution

Remove constraint-aware distribution with fixed pixels. Replace with split selection based on normalized space packing:

```typescript
/**
 * Find optimal split between BESIDE and BELOW.
 * Tests different splits and picks the one that produces valid layout.
 */
export function findBestSplit(
  photos: PhotoDimension[],
  heroAR: number,
  gap: number,
  tuning: V3Tuning
): { besidePhotos: PhotoDimension[]; belowPhotos: PhotoDimension[] } {
  // Sort by AR (portrait photos pack taller, so prefer them for BESIDE)
  const sorted = [...photos].sort((a, b) => a.aspectRatio - b.aspectRatio);
  
  // Try different beside counts, score by layout balance
  let bestSplit = { beside: 0, score: Infinity };
  
  for (let besideCount = 1; besideCount <= Math.min(photos.length - 1, 6); besideCount++) {
    const besidePhotos = sorted.slice(0, besideCount);
    const belowPhotos = sorted.slice(besideCount);
    
    // Pack BESIDE and get its width
    const besideResult = packToFillHeight(besidePhotos, 1.0, gap, tuning);
    const heroRowWidth = heroAR + gap + besideResult.width;
    
    // Pack BELOW and get its height
    const belowResult = packToFillWidth(belowPhotos, heroRowWidth, gap, tuning);
    
    // Score: prefer layouts where hero row and below region are balanced
    const heroRowHeight = 1.0;
    const belowHeight = belowResult.height;
    const heightRatio = heroRowHeight / (heroRowHeight + belowHeight);
    
    // Ideal: hero row is 40-60% of total height
    const score = Math.abs(heightRatio - 0.5);
    
    if (score < bestSplit.score) {
      bestSplit = { beside: besideCount, score };
    }
  }
  
  return {
    besidePhotos: sorted.slice(0, bestSplit.beside),
    belowPhotos: sorted.slice(bestSplit.beside),
  };
}
```

---

## Technical Details

### Gap Handling

In normalized space, gap is a fraction of hero height (e.g., 0.02 = 2%). When scaling to pixels:

```text
pixelGap = normalizedGap × scaleFactor
```

But we want a fixed pixel gap (e.g., 4px). So we work backward:

```text
normalizedGap = gap / (canvasWidth / totalNormalizedWidth)
             = gap × totalNormalizedWidth / canvasWidth
```

This is calculated iteratively or approximated.

### Row Count Selection for BESIDE

For BESIDE (height = 1), row count affects width:
- Fewer rows → wider (more photos side by side)
- More rows → narrower (photos stacked)

The algorithm tries row counts and picks one where:
- Cells meet minimum size
- W_beside produces acceptable canvas AR when combined with hero

### Minimum Cell Size in Normalized Space

```text
minCellWidth_normalized = region_minWidth / canvasWidth × totalNormalizedWidth
```

Since totalNormalizedWidth depends on packing result, this is validated after scaling.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/v3/types.ts` | Add `NormalizedRegion`, `NormalizedCell`, `NormalizedPackResult` |
| `src/lib/v3/entities/hero.ts` | Remove `computeHeroSize`, update `proposePositions` for normalized space |
| `src/lib/v3/row-pack.ts` | Add `packToFillHeight` and `packToFillWidth` functions |
| `src/lib/v3/intersection.ts` | Rewrite `evaluateProposal` for normalized→pixel flow |
| `src/lib/v3/entities/canvas.ts` | Simplify to topology-only (no pixel regions) |
| `src/lib/v3/entities/content-pool.ts` | Replace constraint distribution with split selection |

---

## Result

**Before**: Fixed 55-80% hero width → BESIDE is "leftover" → blank gaps

**After**: Hero AR is input → BESIDE width is derived from packing math → no gaps, balanced layouts

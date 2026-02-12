

# Uniform Row Scaling for Dual-Hero Diagonal-Corners Layout

## Problem
In the diagonal-corners dual-hero layout, Region 2 (beside Hero 2) is width-constrained, which forces Hero 2's height to match the packing result rather than its natural aspect ratio. This distorts Hero 2. The fix is to make Region 2 height-constrained (like Region 0), then uniformly scale the narrower row so both rows match in width -- preserving every cell's aspect ratio perfectly.

## Changes

### 1. Topology: Make Region 2 height-constrained
**File: `src/lib/v3/hero-constraints.ts`** (lines 337-343)

Change Region 2 from `constraint: 'width'` to `constraint: 'height'` with `hardDimension: hH2`, and set `softDimension` to the target beside width (matching how Region 0 works).

```
// Before
constraint: 'width',
hardDimension: 0,
softDimension: hH2,

// After
constraint: 'height',
hardDimension: hH2,
softDimension: Math.max(0.01, targetBesideH2Width),
```

### 2. V4 engine: Uniform row scaling
**File: `src/lib/v4/index.ts`** (lines 691-776)

Replace the current Region 2 width-constrained packing and `actualH2Height` logic with:

- Pack Region 2 as height-constrained at `hH2` (like Region 0)
- Compute natural row widths:
  - `heroRow1Width = wH1 + gap + besideWidth0` (already exists)
  - `heroRow2NaturalWidth = wH2 + gap + besideWidth2`
- Pick canonical width: `canonicalRowWidth = Math.max(heroRow1Width, heroRow2NaturalWidth)`
- Compute scale factors: `scaleRow1 = canonicalRowWidth / heroRow1Width`, `scaleRow2 = canonicalRowWidth / heroRow2NaturalWidth`
- Sanity guard: if either scale > 1.30, skip candidate
- Scale ALL cells in the narrower row (hero dimensions + region cell positions/sizes) by the scale factor on both axes
- Remove `actualH2Height` -- Hero 2 uses `hH2 * scaleRow2`
- Region 1 (middle band) packs width-constrained at `canonicalRowWidth`
- Canvas width = `canonicalRowWidth + 2 * gap`
- Canvas height adjusts based on scaled row heights

### 3. Worker: Same uniform scaling logic
**File: `src/workers/layoutWorker.ts`** (lines 742-758)

Mirror the same changes from the V4 engine:
- Region 2 becomes height-constrained at `hH2`
- Uniform row scaling with scale factor > 1.30 guard (hard reject in worker)
- Remove `actualH2Height`
- Hero 2 area uses scaled dimensions

## What does NOT change
- Topology function signatures
- Single-hero paths (corner-anchor, hero-column, hero-row)
- Region 0 packing (already height-constrained)
- Scoring formulas (same penalties, just using correct scaled areas)
- Template registry
- Rendering / CroppedImage

## Key insight
Instead of distorting one cell to match row widths, scale the entire narrower row uniformly. Every cell keeps its exact aspect ratio. The only visual effect is the narrower row's cells are slightly larger.

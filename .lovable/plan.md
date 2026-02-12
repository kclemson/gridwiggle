

# Fix: Height-Constrain Region 2 + Flex Hero 2 Width

## Problem

Region 2 (beside Hero 2) is width-constrained to force both rows to the same width. This means Hero 2's height is dictated by the packing result, distorting its aspect ratio. The topology docstring even says Region 2 should be "height-constrained at hH2" -- the code contradicts the spec.

## Why It Showed Up Recently

The previous worker crash on single-region templates forced a V3 fallback (which has no dual-hero). The crash fix means V4's dual-hero path now actually runs, exposing this pre-existing bug.

## The Fix

Mirror Region 0's approach for Region 2: height-constrain it to `hH2`. Then absorb any width difference by flexing Hero 2's width (not height). This keeps both rows pixel-aligned to the same total width while preserving Hero 2's natural height.

```text
Top row:    [Hero 1 (wH1 x hH1) | Region 0 (? x hH1)]  -- total width = heroRow1Width
Middle:     [         Region 1 (heroRow1Width x ?)      ]
Bottom row: [Region 2 (? x hH2) | Hero 2 (wH2' x hH2) ]  -- total width forced to heroRow1Width
                                          ^
                                   wH2' = heroRow1Width - region2Width - gap
                                   (flexed to fill, slight AR shift but height preserved)
```

Hero 2's width adjustment is small (typically less than 5%) and only affects horizontal cropping, which is far less visually jarring than the current vertical squishing.

## Technical Changes

### 1. `src/lib/v3/hero-constraints.ts` -- diagonalCornersTopology (line 337-343)

Fix Region 2 to match the docstring:

```typescript
{
  // Region 2: beside Hero 2, height-constrained at hH2
  constraint: 'height',
  hardDimension: hH2,
  softDimension: Math.max(0.01, targetBesideH2Width),
  offset: { x: gap, y: 0 }, // y set by engine after packing middle
},
```

### 2. `src/lib/v4/index.ts` -- dual-hero path (lines ~691-776)

Replace the width-constrained Region 2 packing with height-constrained:

- Pack Region 2 with `constraint: 'height'`, `targetDimension: hH2`, `targetSoftDimension` from topology
- After packing, compute `besideWidth2 = region2.result?.width ?? 0`
- Compute `heroRow2Width = besideWidth2 + (r2Count > 0 ? normalizedGap : 0) + wH2`
- If `heroRow2Width !== heroRow1Width`: flex Hero 2's width to fill: `adjustedWH2 = heroRow1Width - besideWidth2 - (r2Count > 0 ? normalizedGap : 0)`
- Hero 2 cell uses `{ width: adjustedWH2, height: hH2 }` -- height is always natural, width absorbs the difference
- Remove the `actualH2Height` variable entirely -- Hero 2 height is always `hH2`

### 3. `src/workers/layoutWorker.ts` -- dual-hero path (lines ~742-758)

Same changes synced to the worker.

## What This Achieves

- Hero 2 always keeps its natural height (no vertical squishing)
- Both rows always have the same total width (no blank rectangles)
- Width flex on Hero 2 is minimal and far less noticeable than height distortion
- The topology spec, the topology function, and the engine code are all in agreement

## What Does NOT Change

- Region 0 (already correct)
- Region 1 / middle band (still width-constrained to heroRow1Width)
- Single-hero paths
- Template registry constraints
- Scoring logic

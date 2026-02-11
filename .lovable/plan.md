

# AR-Aware Row Selection with Generic Region Abstraction

## What Problem Are We Solving

Two issues in one change:

1. **Row counts ignore the target canvas AR.** `deriveRegionCounts` picks a photo split for a specific target AR (e.g., 2.0), but the row-count selection brute-forces all options, producing actual canvas ARs that can diverge wildly (e.g., 0.83). The photo split looks nonsensical because it was designed for a completely different shape.

2. **The code is hardwired to "beside" and "below."** Every type, interface, variable, and function is named for a 2-region corner-anchor topology. Adding a third region (for two heroes or edge placement) would mean duplicating all of this rather than extending it.

## What Users Experience

More coherent layouts -- the hero prominence and photo distribution will match what the geometry intended. Fewer "weird" splits like 12 beside / 11 below on a portrait canvas with a landscape hero.

## Design Intent: Generic Packable Regions

Instead of `besideCells`, `belowCells`, `besideRowCount`, `belowRowCount`, the system works with an array of **`PackableRegion`** objects. Each region knows:

- Its **constraint type**: height-constrained (pack to fill a known height, derive width) or width-constrained (pack to fill a known width, derive height)
- Its **target dimension**: the height or width it should fill
- Its **assigned photos**
- Its **target row count** (derived from geometry, not brute-forced)
- Its **packed result** (cells after packing)

A corner-anchor template produces 2 regions. A future edge-anchor or dual-hero template produces 3. The candidate generation loop, scoring, and layout assembly all operate on `regions[]` without knowing how many there are or what they're called.

```text
Current:                          Proposed:
                                  
LayoutCandidate {                 LayoutCandidate {
  besideCount                       regions: PackableRegion[]
  besideRowCount                    heroCell
  belowRowCount                     canvasWidth, canvasHeight
  besideCells                       score, corner
  belowCells                      }
  heroCell                        
  canvasWidth, canvasHeight       PackableRegion {
  score, corner                     constraint: 'height' | 'width'
}                                   targetDimension: number
                                    photos: PhotoDimension[]
                                    targetRowCount: number
                                    cells: NormalizedCell[]
                                    offset: { x, y }
                                  }
```

## AR-Aware Row Count Derivation

Once we know the target canvas AR, hero AR, and area fraction, the target dimensions for each region are geometrically fixed:

```text
hHero = sqrt(areaFrac * targetCanvasAR / heroAR)
wHero = heroAR * hHero

Region 0 (height-constrained, beside hero):
  targetHeight = hHero  (= 1.0 in normalized space)
  targetWidth  = targetCanvasAR - wHero
  
Region 1 (width-constrained, below hero row):
  targetWidth  = targetCanvasAR  (full canvas width)
  targetHeight = 1.0 - hHero     (remaining vertical space)
```

From target dimensions, derive optimal row count:

```text
Height-constrained (region 0):
  rowCount = round(photoCount * meanAR * targetHeight / targetWidth)
  
Width-constrained (region 1):
  rowCount = round(photoCount * meanAR * targetHeight / targetWidth)
```

Both formulas are the same equation -- "how many rows make cells whose aspect ratio matches the region's shape?" Try the derived value and +/- 1 for robustness (3 candidates instead of N).

### Test Matrix: heroAR=1.5, f=0.20, 23 content photos

```text
targetCanvasAR    besideCount    targetBesideW    besideRows(derived)    targetBelowH    belowRows(derived)
──────────────────────────────────────────────────────────────────────────────────────────────────────────
0.70              3              0.15             2                      0.63            2
1.00              4              0.36             1                      0.63            3
1.50              6              0.73             1                      0.63            4
2.00              8              1.10             1                      0.63            5
2.25              9              1.28             1                      0.63            5
```

Notice how the row counts track the region shape: a narrow beside region (0.15 wide) needs 2 rows to avoid extreme landscape cells, while a wide beside region (1.10) fits everything in 1 row. Below rows increase with canvas width because more photos go below and the region gets wider.

## What Changes

| File | Change |
|------|--------|
| `src/lib/v3/utils.ts` | Add `deriveTargetRowCount(photoCount, meanAR, targetWidth, targetHeight)` utility |
| `src/lib/v3/types.ts` | Add `PackableRegion` interface |
| `src/workers/layoutWorker.ts` | Refactor `LayoutCandidate` to use `regions[]`, derive row counts from target dimensions, replace beside/below-specific code with region-generic loops |
| `src/lib/v4/index.ts` | Same refactor (sync fallback path) |
| `src/test/layout/deriveRegionCounts.test.ts` | Add tests for `deriveTargetRowCount` |

## Technical Details

### New type: `PackableRegion`

Location: `src/lib/v3/types.ts`

```text
interface PackableRegion {
  /** 'height' = packToFillHeight, 'width' = packToFillWidth */
  constraint: 'height' | 'width';
  /** The fixed dimension (height for height-constrained, width for width-constrained) */
  targetDimension: number;
  /** Photos assigned to this region */
  photos: PhotoDimension[];
  /** Geometrically-derived row count */
  targetRowCount: number;
  /** Offset for positioning in canvas space */
  offset: { x: number; y: number };
  /** Packed result (filled after packing) */
  result: NormalizedPackResult | null;
}
```

### New function: `deriveTargetRowCount`

Location: `src/lib/v3/utils.ts`

```text
deriveTargetRowCount(
  photoCount: number,
  meanAR: number,
  targetWidth: number,
  targetHeight: number
): number
```

The formula: `round(photoCount * meanAR * targetHeight / targetWidth)`, clamped to `[1, ceil(photoCount / 2)]`.

This works for both constraint types -- it answers "how many rows make cells whose shape fits this rectangle?"

### Refactored `generateCandidates` flow

```text
for each targetCanvasAR:
  for each areaFrac:
    1. deriveRegionCounts -> besideCount, belowCount
    2. Compute hHero, wHero from the formula
    3. Build regions array:
       region[0] = {
         constraint: 'height',
         targetDimension: 1.0,           // normalized hero height
         photos: ordered.slice(0, besideCount),
         targetRowCount: deriveTargetRowCount(besideCount, meanAR, targetCanvasAR - wHero, hHero),
         offset: { x: gap + heroAR + gap, y: gap }
       }
       region[1] = {
         constraint: 'width', 
         targetDimension: heroRowWidth,   // filled after packing region 0
         photos: ordered.slice(besideCount),
         targetRowCount: deriveTargetRowCount(belowCount, meanAR, targetCanvasAR, 1 - hHero),
         offset: { x: gap, y: gap + 1.0 + gap }
       }
    4. For each region, try targetRowCount and +/- 1 (3 values max)
    5. Pack each combination, assemble candidate
    6. AR coherence filter: reject if actual AR deviates > 40% from targetCanvasAR
```

### Candidate count impact

Current: 6 canvasAR x 3 areaFrac x ~N besideRows x ~N belowRows (hundreds, many incoherent)
Proposed: 6 canvasAR x 3 areaFrac x 3 besideRows x 3 belowRows = ~162 max, most coherent

With dedup of identical besideCount values across samples, likely 60-80 actual candidates.

### `convertToLayout` becomes region-generic

Instead of separate loops for `besideCells` and `belowCells`, iterate `candidate.regions` and apply each region's offset:

```text
for (const region of candidate.regions) {
  for (const cell of region.result.cells) {
    const pos = transform(
      region.offset.x + cell.x,
      region.offset.y + cell.y,
      cell.width, cell.height
    );
    cells.push({ ... });
  }
}
```

This loop works for 2 regions today and 3+ regions tomorrow with zero changes.

### AR coherence filter

After packing all regions and computing actual canvas AR, reject candidates where `|actualAR - targetAR| / targetAR > 0.4`. This catches the case from the screenshot (target 2.0, actual 0.83 = 59% deviation). The threshold is generous (40%) to allow natural variation while preventing the extreme mismatches.

### Edge cases

- **Region with 0 photos**: Skip packing, result is empty. The offset and dimensions are still valid for canvas assembly.
- **deriveTargetRowCount returns 0**: Clamped to 1.
- **targetWidth <= 0 for beside region**: Hero wider than canvas. besideCount already 0 from `deriveRegionCounts`; region[0] has empty photos array.
- **All 3 row-count variants fail packing**: No candidate produced for that (canvasAR, areaFrac) pair. Other samples will cover.

### Future extensibility

When adding edge-anchor (hero centered on top edge), the template produces 3 regions:
- Region 0: left of hero (height-constrained)
- Region 1: right of hero (height-constrained) 
- Region 2: below hero row (width-constrained)

The only changes needed: the template's region-building code produces 3 entries instead of 2, and `deriveRegionCounts` returns a 3-way split. The packing loop, scoring, and layout assembly work unchanged.


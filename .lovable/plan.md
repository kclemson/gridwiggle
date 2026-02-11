

# Make the Packer Dimension-Aware via Soft Targets

## What Problem Are We Solving

`packToFillHeight` currently takes a fixed height and row count, then produces whatever width the geometry dictates. Even with `deriveTargetRowCount`, the actual width can deviate significantly from what the target canvas AR requires -- because the row count formula uses mean AR as an approximation, while actual photo AR distribution varies. This causes the beside region to be much wider or narrower than intended, producing incoherent layouts (e.g., 11 photos crammed into a narrow strip).

## What Users Experience

Layouts where the photo distribution between regions matches the intended canvas shape. No more "crammed beside" or "empty below" layouts where the actual canvas AR is nothing like what the photo split was designed for.

## Design Intent

Each `PackableRegion` already knows its hard constraint (height or width). We add a **soft target** for the unconstrained dimension. The packer then internally searches for the row count that minimizes deviation from the soft target, instead of blindly using a single derived row count.

This eliminates the outer row-count variant loop entirely -- the packer itself finds the best fit. The candidate generator simplifies to: build regions with targets, pack them, check coherence.

## What Changes

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Add `targetSoftDimension` to `PackableRegion` |
| `src/lib/v3/normalized-pack.ts` | Add `packToFillHeightAtTargetWidth` and `packToFillWidthAtTargetHeight` that search row counts to minimize soft-dimension deviation |
| `src/lib/v4/index.ts` | Update `packRegion` to use new dimension-aware packers, remove `rowCountVariants` outer loop |
| `src/workers/layoutWorker.ts` | Same updates as v4/index.ts |

## Technical Details

### PackableRegion gains `targetSoftDimension`

```text
interface PackableRegion {
  constraint: 'height' | 'width';
  targetDimension: number;          // hard: must match exactly
  targetSoftDimension?: number;     // soft: try to match (optional)
  photos: PhotoDimension[];
  targetRowCount: number;           // initial estimate (used as search center)
  offset: { x: number; y: number };
  result: NormalizedPackResult | null;
}
```

### New packer functions in `normalized-pack.ts`

**`packToFillHeightAtTargetWidth`**: Given photos, a fixed height, and a target width:

1. Compute the valid row count range: `[1, ceil(photoCount/2)]`
2. Start from `deriveTargetRowCount` estimate
3. Try row counts in expanding radius from estimate (0, +1, -1, +2, -2, ...)
4. For each row count, call existing `packToFillHeight` to get actual width
5. Track the row count whose actual width is closest to target width
6. Return the best result

This keeps `packToFillHeight` pure (no changes to it). The new function wraps it with a search.

**`packToFillWidthAtTargetHeight`**: Same pattern for width-constrained regions -- searches row counts to minimize height deviation from target.

Both functions cap the search at ~5 row count variants (the estimate +/- 2), keeping performance identical to the current 3-variant outer loop but with better targeting.

### Candidate generator simplification

Current flow (outer loop over row count variants):
```text
for besideRowCount in [target-1, target, target+1]:
  for belowRowCount in [target-1, target, target+1]:
    pack region 0 with besideRowCount
    pack region 1 with belowRowCount
    check coherence
    → up to 9 pack attempts per (canvasAR, areaFrac) pair
```

New flow (packer self-optimizes):
```text
pack region 0 with soft target width → packer finds best row count internally
pack region 1 with soft target height → packer finds best row count internally
check coherence
→ 1 pack attempt per (canvasAR, areaFrac) pair (search is inside packer)
```

The `rowCountVariants` function and the nested for-loops over row counts are removed. Each (canvasAR, areaFrac) pair produces exactly one candidate, pre-optimized for dimensional coherence.

### Building the regions with soft targets

```text
// Height-constrained region (beside hero)
region[0] = {
  constraint: 'height',
  targetDimension: 1.0,                    // hard: hero height
  targetSoftDimension: targetBesideWidth,  // soft: derived from canvas AR
  ...
}

// Width-constrained region (below hero row)  
region[1] = {
  constraint: 'width',
  targetDimension: heroRowWidth,           // hard: hero row width (after region 0 packed)
  targetSoftDimension: targetBelowHeight,  // soft: derived from canvas AR
  ...
}
```

### Search algorithm detail

For `packToFillHeightAtTargetWidth(photos, height, gap, targetWidth, tuning, randomize)`:

```text
estimate = deriveTargetRowCount(count, meanAR, targetWidth, height)
bestResult = null
bestDeviation = Infinity

for delta in [0, -1, 1, -2, 2]:
  rc = clamp(estimate + delta, 1, ceil(count/2))
  result = packToFillHeight(photos, height, gap, rc, tuning, randomize)
  if result.cells.length == 0: continue
  deviation = |result.width - targetWidth| / targetWidth
  if deviation < bestDeviation:
    bestDeviation = deviation
    bestResult = result

return bestResult
```

The search is bounded (max 5 iterations) and deterministic. Each iteration is cheap (just row distribution + arithmetic).

### Candidate count impact

Current: 6 canvasAR x 3 areaFrac x 9 row combos = ~162 pack operations
New: 6 canvasAR x 3 areaFrac x 1 = ~18 pack operations (each doing ~5 internal row searches = ~90 total row packs)

Net: similar compute, but every candidate is pre-optimized for dimensional fit. No more "spray and pray" row count enumeration.

### AR coherence threshold

Keep the 40% threshold as a safety net, but with dimension-aware packing most candidates will naturally be within 10-20% of target. The filter becomes a backstop rather than the primary quality gate.

### Edge cases

- **targetSoftDimension not provided**: Fall back to current behavior (use targetRowCount directly)
- **All row counts produce 0 cells**: Return null result, candidate is rejected
- **Very few photos (1-2)**: Row count search is trivial (only 1 valid option), no performance concern
- **Search finds two row counts with equal deviation**: Pick the one closest to the estimate (lower row count wins on tie)


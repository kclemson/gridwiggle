# V4 Layout Orchestrator - IMPLEMENTED

## Status: ✅ Complete

The V4 orchestrator has been implemented and is now the production layout engine.

## What Changed

### Created
- `src/lib/v4/index.ts` - Standalone V4 orchestrator (~300 lines)
- Updated `src/workers/layoutWorker.ts` - V4 implementation in worker (~465 lines total)

### Key Improvements
1. **NO CAP on besideCount** - All configurations explored (0 to n-1)
2. **Simple row count logic** - 1 to ceil(count/2) for both regions
3. **Minimal constraints** - Only canvas AR bounds + hero prominence
4. **Reuses proven math** - packToFillWidth, packToFillHeight from V3
5. **F-ratio scoring** - Tier coherence + presence bonus
6. **Weighted random selection** - High-scoring candidates heavily favored

### Architecture

```text
generateLayout()
  └── generateCandidates()  - Explores ALL besideCount × rowCount combos
      └── packToFillHeight() - V3 math for BESIDE region
      └── packToFillWidth()  - V3 math for BELOW region
      └── tierCoherenceScore() - F-ratio scoring
  └── weightedRandomSelect() - Pick from valid candidates
  └── convertToLayout()      - Apply corner transform, scale to pixels
```

## Test Matrix (Expected)

| Photo Count | Hero AR | Expected Candidates | Canvas AR Range |
|-------------|---------|---------------------|-----------------|
| 10 | 1.5 | 20+ | 0.5 - 2.25 |
| 20 | 0.7 | 100+ | 0.5 - 2.25 |
| 46 | 1.75 | 500+ | 0.5 - 2.25 |

## Files to Clean Up (Future)

These V3 files are no longer used by the production worker but kept for reference:
- `src/lib/v3/intersection.ts`
- `src/lib/v3/region-search.ts`
- `src/lib/v3/entities/hero.ts`

The V3 entry point (`src/lib/v3/index.ts`) is kept for the sync fallback path.


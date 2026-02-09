

# Fix scoreConfiguration: Replace Uniformity with Tier Coherence

## The Smoking Gun

Two scoring layers are **fighting each other**:

| Layer | File | Metric | What it rewards |
|-------|------|--------|-----------------|
| Region Search | `region-search.ts` | `tierCoherenceScore` | Distinct size hierarchy (Large/Medium/Small tiers) |
| Final Selection | `intersection.ts` | `areaUniformity` | All cells same size |

The final selection step undoes the variety that region-search found.

## The Fix

Replace `areaUniformity` with `tierCoherenceScore` in `scoreConfiguration()`:

### File: `src/lib/v3/intersection.ts`

**Step 1: Move `tierCoherenceScore` to shared utility**

The function already exists in `region-search.ts`. We need to either:
- Move it to `utils.ts` and import in both files, OR
- Just copy/extract it to `intersection.ts`

Best practice: move to `utils.ts` for reuse.

**Step 2: Update `scoreConfiguration` (lines 556-573)**

```typescript
// Before
function scoreConfiguration(
  prominenceRatio: number,
  cells: LayoutCell[],
  tuning: V3Tuning,
  randomize: boolean
): number {
  const prominenceScore = prominenceRatio / tuning.hero_targetProminence;
  
  // Cell area uniformity (lower variance = better)  ← PROBLEM
  const areas = cells.slice(1).map(c => c.width * c.height);
  const areaUniformity = areas.length > 1 ? 1 / (1 + coefficientOfVariation(areas)) : 1;
  
  const randomTiebreaker = randomize ? Math.random() * 0.01 : 0;
  
  return (prominenceScore * 0.6) + (areaUniformity * 0.4) + randomTiebreaker;
}

// After
function scoreConfiguration(
  prominenceRatio: number,
  cells: LayoutCell[],
  tuning: V3Tuning,
  randomize: boolean
): number {
  const prominenceScore = prominenceRatio / tuning.hero_targetProminence;
  
  // Tier coherence: reward distinct size hierarchy (consistent with region-search)
  const areas = cells.slice(1).map(c => c.width * c.height);
  const coherenceScore = tierCoherenceScore(areas);
  
  const randomTiebreaker = randomize ? Math.random() * 0.01 : 0;
  
  return (prominenceScore * 0.6) + (coherenceScore * 0.4) + randomTiebreaker;
}
```

## Files to Change

| File | Change |
|------|--------|
| `src/lib/v3/utils.ts` | Add `tierCoherenceScore` function (move from region-search) |
| `src/lib/v3/region-search.ts` | Import `tierCoherenceScore` from utils (remove local copy) |
| `src/lib/v3/intersection.ts` | Import `tierCoherenceScore` from utils, replace `areaUniformity` with `coherenceScore` |

## Why This Fixes the Problem

- **Before**: Region-search finds configs with good hierarchy → final scoring penalizes them for "not being uniform" → tall/uniform layouts win
- **After**: Both layers reward the same thing (hierarchy) → diverse configurations compete fairly → wider AR variety

## Expected Impact

For 46-photo sets with portrait hero:
- Layouts with more BESIDE photos (producing wider canvases) will no longer be penalized for having varied cell sizes
- The scoring will be consistent from region-search through final selection
- Canvas AR distribution should widen significantly


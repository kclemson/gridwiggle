

# New Architecture: "V4" Orchestrator

## The Insight

Instead of continuing to strip layers from V3, we build a **new orchestrator** that calls only the proven math. The existing V3 has:

- **Battle-tested math functions** (packToFillWidth, packToFillHeight, distributeByARBudget)
- **Layers of orchestration** (region-search loop, proposal evaluation, scoring) that add complexity without adding variety

The new approach: a simple orchestrator that generates candidates directly, calls the packing math, and picks from valid results.

---

## What Sparks Joy (Keep as Library Functions)

| Function | File | Purpose |
|----------|------|---------|
| `packToFillWidth` | normalized-pack.ts | Pack photos into rows at fixed width → returns height |
| `packToFillHeight` | normalized-pack.ts | Pack photos into rows at fixed height → returns width |
| `distributeByARBudget` | utils.ts | Greedy AR-budget row distribution with jitter |
| `shuffleArray` | utils.ts | Fisher-Yates shuffle |
| `weightedRandomSelect` | region-search.ts | Score-weighted random selection |
| `tierCoherenceScore` | region-search.ts | F-ratio scoring |

---

## What Doesn't Spark Joy (Replace with Simpler Orchestration)

| Current Pattern | Problem | Replacement |
|-----------------|---------|-------------|
| Nested for-loops (besideCount × rowCount) | Explores limited space, complex flow | **Direct candidate generation** |
| `calculateSimpleBesideRange` capped at 12 | Prevents landscape layouts | **Remove cap entirely** |
| `calculateBelowRowCount` with AR constraints | Duplicates canvas AR checks | **Simple row count range** |
| Separate `evaluateNormalizedProposal` | Extra layer | **Inline in orchestrator** |
| `proposePositions` returning single proposal | Vestigial complexity | **Just use corner mode** |

---

## New Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     generateLayoutV4()                          │
│  Entry point - replaces generateCollageLayoutV3()               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   generateCandidates()                          │
│  - For besideCount in [0, 1, 2, 3, ... n-1]                     │
│  - Slice photos into beside/below                               │
│  - For rowCount in simple range                                 │
│  - Call packToFillHeight + packToFillWidth                      │
│  - Calculate canvas AR, check bounds                            │
│  - Check prominence                                             │
│  - Score with F-ratio                                           │
│  → Returns: Candidate[]                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 selectCandidate()                               │
│  - If randomize: weightedRandomSelect(candidates)               │
│  - Else: pick highest score                                     │
│  → Returns: single Candidate                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              convertToLayout()                                  │
│  - Apply random corner position                                 │
│  - Convert normalized cells to CollageLayout                    │
│  → Returns: CollageLayout                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Create New Orchestrator

**New File: `src/lib/v4/index.ts`**

Single file, ~200 lines, containing:

1. **Candidate interface**
```typescript
interface LayoutCandidate {
  besideCount: number;
  besideRowCount: number;
  belowRowCount: number;
  besideCells: NormalizedCell[];
  belowCells: NormalizedCell[];
  canvasWidth: number;
  canvasHeight: number;
  prominenceRatio: number;
  score: number;
}
```

2. **generateCandidates()** - The core loop
```typescript
function generateCandidates(
  photos: PhotoDimension[],
  heroPhoto: PhotoDimension,
  normalizedGap: number,
  tuning: V3Tuning,
  randomize: boolean
): LayoutCandidate[] {
  const heroAR = heroPhoto.aspectRatio;
  const contentPhotos = photos.filter(p => p.id !== heroPhoto.id);
  const candidates: LayoutCandidate[] = [];
  
  // Shuffle content if randomizing
  const ordered = randomize ? shuffleArray(contentPhotos) : contentPhotos;
  
  // Key change: NO CAP on besideCount
  for (let besideCount = 0; besideCount < ordered.length; besideCount++) {
    const beside = ordered.slice(0, besideCount);
    const below = ordered.slice(besideCount);
    
    // Simple row count range for beside: 1 to ceil(besideCount/2)
    const maxBesideRows = Math.max(1, Math.ceil(besideCount / 2));
    
    for (let besideRowCount = 1; besideRowCount <= maxBesideRows; besideRowCount++) {
      // Pack beside (if any)
      const besideResult = besideCount > 0 
        ? packToFillHeight(beside, 1.0, normalizedGap, besideRowCount, tuning, randomize)
        : { cells: [], width: 0, height: 1.0 };
      
      // Hero row width
      const heroRowWidth = heroAR + (besideCount > 0 ? normalizedGap + besideResult.width : 0);
      
      // Simple row count range for below
      const maxBelowRows = Math.max(1, Math.ceil(below.length / 3));
      const belowRowCount = randomize 
        ? 1 + Math.floor(Math.random() * maxBelowRows)
        : Math.ceil(below.length / 4);
      
      // Pack below
      const belowResult = below.length > 0
        ? packToFillWidth(below, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize)
        : { cells: [], width: heroRowWidth, height: 0 };
      
      // Canvas dimensions
      const totalHeight = 1.0 + (below.length > 0 ? normalizedGap + belowResult.height : 0);
      const canvasWidth = heroRowWidth + 2 * normalizedGap;
      const canvasHeight = totalHeight + 2 * normalizedGap;
      const canvasAR = canvasWidth / canvasHeight;
      
      // HARD BOUNDS (only constraint)
      if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
        continue;
      }
      
      // Prominence check (hero vs beside only)
      const besideAreas = besideResult.cells.map(c => c.width * c.height);
      const heroArea = heroAR * 1.0;
      const maxBesideArea = Math.max(...besideAreas, 0);
      const prominenceRatio = maxBesideArea > 0 ? heroArea / maxBesideArea : Infinity;
      
      if (prominenceRatio < tuning.hero_minProminence) {
        continue;
      }
      
      // Score using F-ratio
      const allAreas = [...besideAreas, ...belowResult.cells.map(c => c.width * c.height)];
      const score = tierCoherenceScore(allAreas);
      
      candidates.push({
        besideCount,
        besideRowCount,
        belowRowCount,
        besideCells: besideResult.cells,
        belowCells: belowResult.cells,
        canvasWidth,
        canvasHeight,
        prominenceRatio,
        score,
      });
    }
  }
  
  return candidates;
}
```

3. **selectCandidate()** - Simple selection
```typescript
function selectCandidate(
  candidates: LayoutCandidate[],
  randomize: boolean
): LayoutCandidate | null {
  if (candidates.length === 0) return null;
  
  return randomize 
    ? weightedRandomSelect(candidates)
    : candidates.reduce((best, c) => c.score > best.score ? c : best);
}
```

4. **convertToLayout()** - Final assembly
```typescript
function convertToLayout(
  candidate: LayoutCandidate,
  heroPhoto: PhotoDimension,
  normalizedGap: number,
  randomize: boolean
): CollageLayout {
  const cells: CollageCell[] = [];
  const borderOffset = normalizedGap;
  
  // Random corner selection
  const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const corner = randomize 
    ? corners[Math.floor(Math.random() * 4)]
    : 'top-left';
  
  // Position hero and cells based on corner
  // ... (coordinate mapping logic)
  
  return {
    width: Math.round(candidate.canvasWidth * 1000),
    height: Math.round(candidate.canvasHeight * 1000),
    cells,
  };
}
```

---

### Phase 2: Wire Up Entry Point

**Update: `src/lib/v3/index.ts`**

Add a toggle to use V4 orchestrator:

```typescript
// At top of generateCollageLayoutV3:
if (options.useV4) {
  return generateLayoutV4(photos, settings, options);
}
```

Or create separate `src/lib/v4/index.ts` with its own entry point.

---

### Phase 3: Test Matrix

| Photo Count | Hero AR | Expected Candidates | Expected AR Range |
|-------------|---------|---------------------|-------------------|
| 10 | 1.5 | ~20+ (0-9 beside × row variants) | 0.5 - 2.0 |
| 20 | 0.7 | ~50+ (0-19 beside × row variants) | 0.5 - 2.0 |
| 46 | 1.75 | ~100+ (0-45 beside × row variants) | 0.5 - 2.0 |
| 46 | 1.75 (randomize) | Weighted selection from 100+ | Full variety |

---

## Why This Approach Works

1. **Removes the 12-photo cap** - All besideCount values are explored
2. **Simple row count logic** - No complex constraint calculations
3. **Single validation point** - Canvas AR bounds + prominence, nothing else
4. **Reuses proven math** - packToFillWidth, packToFillHeight, F-ratio scoring
5. **~200 lines vs ~800 lines** - Much simpler mental model
6. **Easy to debug** - Single linear flow, no nested evaluators

---

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `src/lib/v4/index.ts` | New orchestrator (~200 lines) |
| KEEP | `src/lib/v3/normalized-pack.ts` | Packing math (import from v4) |
| KEEP | `src/lib/v3/utils.ts` | Utility functions (import from v4) |
| OPTIONAL DELETE | `src/lib/v3/region-search.ts` | Replaced by v4 loop |
| OPTIONAL DELETE | `src/lib/v3/intersection.ts` | Replaced by v4 orchestrator |
| OPTIONAL DELETE | `src/lib/v3/entities/hero.ts` | Proposals no longer needed |

Total new code: ~200 lines  
Total deletable code: ~800 lines  
Net change: **-600 lines**


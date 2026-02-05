

# Unified `scoreConfiguration` Function

## Core Insight

Both content-only and hero layouts need to be scored using the **same metrics**. The difference is just which metrics apply:

| Metric | Content-Only | Hero Layout |
|--------|--------------|-------------|
| Direction penalty (shape) | ✓ | ✓ |
| Area CV (uniformity) | ✓ | ✓ (for content rows) |
| Height CV | ✓ | ✓ (for content rows) |
| Sparse row penalty | ✓ | ✓ (for content rows) |
| Scale factor penalty | — | ✓ (deviation from 1.0) |
| Hero coverage | — | ✓ (optional soft preference) |

---

## Proposed Design

### Single Scoring Function

```typescript
export interface ConfigurationScore {
  directionPenalty: number;  // Shape compliance (10.0 weight)
  areaCV: number;            // Cell size uniformity
  heightCV: number;          // Row height uniformity
  rowBalancePenalty: number; // Sparse/overfull rows
  scalePenalty: number;      // For hero: deviation from 1.0
  totalScore: number;        // Combined (lower = better)
}

export interface ScoreConfigurationOptions {
  shape: CollageSettings['shape'];
  hasHero: boolean;
  scaleFactor?: number;      // Only for hero layouts
  heroCoverage?: number;     // Optional: hero area / total area
  minPhotosPerRow?: number;
}

export function scoreConfiguration(
  layout: CollageLayout,
  options: ScoreConfigurationOptions
): ConfigurationScore
```

### What It Calculates

1. **Direction penalty** — Always calculated from `layout.width / layout.height` vs target `shape`
2. **Scale penalty** — Only when `hasHero: true`, penalizes `scaleFactor` deviating from 1.0
3. **Row metrics** — Calculated from the layout cells (grouping by y-position to identify rows)

---

## Implementation

### File: `src/lib/collageLayout.ts`

#### 1. Extract direction penalty (small helper)

```typescript
function calculateDirectionPenalty(
  resultAspect: number,
  shape: CollageSettings['shape']
): number {
  if (shape === 'portrait' && resultAspect >= 1.0) {
    return 10.0 * (resultAspect - 0.9);
  } else if (shape === 'landscape' && resultAspect <= 1.0) {
    return 10.0 * (1.1 - resultAspect);
  } else if (shape === 'square') {
    return 10.0 * Math.abs(resultAspect - 1.0);
  }
  return 0;
}
```

#### 2. New unified `scoreConfiguration` function

```typescript
export function scoreConfiguration(
  layout: CollageLayout,
  options: ScoreConfigurationOptions
): ConfigurationScore {
  const { shape, hasHero, scaleFactor = 1.0, minPhotosPerRow = 2 } = options;
  
  const resultAspect = layout.width / layout.height;
  const directionPenalty = calculateDirectionPenalty(resultAspect, shape);
  
  // Scale penalty for hero layouts (deviation from 1.0)
  const scalePenalty = hasHero 
    ? 2.0 * Math.abs(scaleFactor - 1.0) 
    : 0;
  
  // Calculate row-based metrics from layout cells
  const { areaCV, heightCV, rowBalancePenalty } = calculateRowMetrics(
    layout.cells, 
    layout.width,
    minPhotosPerRow,
    shape
  );
  
  const totalScore = 
    directionPenalty +
    scalePenalty +
    areaCV * 1.0 +
    heightCV * 0.2 +
    rowBalancePenalty;
  
  return { directionPenalty, areaCV, heightCV, rowBalancePenalty, scalePenalty, totalScore };
}
```

#### 3. Update `scorePartition` to use the shared logic

The existing `scorePartition` can call into the shared direction penalty calculation, or be refactored to use `scoreConfiguration` internally by first building the layout from the partition.

---

### File: `src/lib/heroLayout.ts`

#### Update hero layout functions to use unified scoring

```typescript
import { scoreConfiguration } from '@/lib/collageLayout';

// In generateEdgeAnchoredHeroLayout, change from "return first valid" to "collect and score":

const candidates: Array<{ layout: CollageLayout; score: ConfigurationScore }> = [];

// Inside the loop, after building layout:
if (accepted) {
  const layout = { width: canvasWidth, height: finalHeight, cells: allCells };
  const score = scoreConfiguration(layout, {
    shape,
    hasHero: true,
    scaleFactor,
  });
  candidates.push({ layout, score });
}

// After loop: pick best
if (candidates.length > 0) {
  candidates.sort((a, b) => a.score.totalScore - b.score.totalScore);
  return candidates[0].layout;
}
```

---

## Benefits

1. **Single source of truth** — All scoring logic in one function
2. **Consistent behavior** — Content-only and hero layouts scored identically
3. **Easy to tune** — Change weights in one place
4. **Testable** — Can unit test `scoreConfiguration` with mock layouts
5. **Extensible** — Adding new metrics (e.g., "whitespace penalty") is trivial

---

## Technical Details

### Row Metrics From Layout Cells

Since hero layouts don't have a `partition` array, we need to derive row information from the layout cells:

```typescript
function calculateRowMetrics(
  cells: CollageCell[],
  canvasWidth: number,
  minPhotosPerRow: number,
  shape: CollageSettings['shape']
): { areaCV: number; heightCV: number; rowBalancePenalty: number } {
  // Group cells by y-position to identify rows
  const rowMap = new Map<number, CollageCell[]>();
  for (const cell of cells) {
    const key = cell.y;
    if (!rowMap.has(key)) rowMap.set(key, []);
    rowMap.get(key)!.push(cell);
  }
  
  const rows = Array.from(rowMap.values());
  
  // Calculate areas and heights
  const areas = cells.map(c => c.width * c.height);
  const heights = rows.map(row => Math.max(...row.map(c => c.height)));
  
  const areaCV = coefficientOfVariation(areas);
  const heightCV = coefficientOfVariation(heights);
  
  // Row balance penalty
  const rowSizes = rows.map(r => r.length);
  const minRowSize = Math.min(...rowSizes);
  const maxRowSize = Math.max(...rowSizes);
  
  const sparsePenalty = minRowSize < minPhotosPerRow 
    ? 5.0 * (minPhotosPerRow - minRowSize) 
    : 0;
  
  const maxPhotosPerRow = getMaxPhotosPerRow(cells.length, shape);
  const overMaxPenalty = maxRowSize > maxPhotosPerRow
    ? 3.0 * (maxRowSize - maxPhotosPerRow)
    : 0;
  
  return { areaCV, heightCV, rowBalancePenalty: sparsePenalty + overMaxPenalty };
}
```

---

## Migration Path

### Phase 1: Add `scoreConfiguration` alongside existing `scorePartition`
- Both use the same `calculateDirectionPenalty` helper
- `scorePartition` continues working for content-only path
- No behavior change yet

### Phase 2: Thread `shape` through hero functions + use scoring
- Hero functions receive `shape` parameter
- Change from "return first valid" to "collect candidates, score, pick best"
- Uses `scoreConfiguration` for hero candidates

### Phase 3: Optionally refactor `scorePartition` to use `scoreConfiguration`
- `scorePartition` could build a temporary layout and call `scoreConfiguration`
- Or keep it as-is since it's already well-tested

---

## Files Changed

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Add `scoreConfiguration`, `calculateDirectionPenalty`, `calculateRowMetrics`. Export them. |
| `src/lib/heroLayout.ts` | Import `scoreConfiguration`. Add `shape` to 4 function signatures. Change loops to collect-and-score. |
| `src/lib/layoutBlocks.ts` | Add `shape` to `HeroUnitOptions`. Pass through in `buildHeroUnitBlock`. |


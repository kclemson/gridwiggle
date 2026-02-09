

# General-Purpose Cell Scoring for V4

## Design Intent

Create a scoring function that works on **any set of cells** - the "lego brick" primitive. It doesn't know where cells came from (hero, beside, below) - it just evaluates whether the final packed cells look balanced.

## User Outcomes

| Before | After |
|--------|-------|
| Hero excluded from scoring | All cells evaluated together |
| Extreme spreads (136:1) can score well | Spread penalty rejects crushed layouts |
| Scoring entangled with orchestration | Clean separation: pack → score |
| Fixed spread limits break at scale | Adaptive limits scale with photo count |

---

## Technical Changes

### 1. Add Tuning Parameter

**File: `src/lib/v3/types.ts`**

Add to `V3Tuning` interface (after line 46):

```typescript
/** Base spread limit (largest/smallest area) at 10 photos, scales with √(n/10) */
tier_baseSpreadLimit: number;
```

Add to `DEFAULT_V3_TUNING` (after line 58):

```typescript
tier_baseSpreadLimit: 15,
```

### 2. Create General Scoring Function

**File: `src/lib/v4/index.ts`**

Replace `tierCoherenceScore` (lines 60-95) with unified `scoreCellBalance`:

```typescript
// ============================================================================
// Cell Balance Scoring (F-ratio + Spread Constraint)
// ============================================================================

/**
 * Score a set of cell areas for visual balance.
 * 
 * This is a GENERAL-PURPOSE function that works on ANY set of cells.
 * It has no knowledge of hero/beside/below - just evaluates the geometry.
 * 
 * Two components:
 * 1. COHERENCE (F-ratio): Do cells cluster into distinct size tiers?
 * 2. SPREAD PENALTY: Is the largest/smallest ratio reasonable?
 * 
 * @param areas - All cell areas to evaluate
 * @param photoCount - Total photos for adaptive spread limit
 * @param tuning - V3Tuning for baseSpreadLimit
 * @param tierCount - Number of tiers to detect (default 3)
 */
function scoreCellBalance(
  areas: number[],
  photoCount: number,
  tuning: V3Tuning,
  tierCount: number = 3
): { score: number; coherence: number; spreadRatio: number; spreadPenalty: number } {
  if (areas.length < 2) {
    return { score: 1.0, coherence: 1.0, spreadRatio: 1, spreadPenalty: 0 };
  }
  
  const sorted = [...areas].sort((a, b) => b - a);
  const largest = sorted[0];
  const smallest = sorted[sorted.length - 1];
  
  // === Component 1: Tier Coherence (F-ratio) ===
  let coherence = 0.5;
  if (areas.length >= tierCount * 2) {
    const grandMean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    
    const tierSize = Math.ceil(sorted.length / tierCount);
    const tiers: number[][] = [];
    for (let i = 0; i < tierCount; i++) {
      tiers.push(sorted.slice(i * tierSize, (i + 1) * tierSize));
    }
    
    const tierMeans = tiers.map(tier => 
      tier.reduce((a, b) => a + b, 0) / tier.length
    );
    
    const betweenVar = tierMeans.reduce((sum, mean) => 
      sum + Math.pow(mean - grandMean, 2), 0
    ) / tierCount;
    
    let withinVarSum = 0;
    for (let i = 0; i < tierCount; i++) {
      const tierMean = tierMeans[i];
      const tierVar = tiers[i].reduce((sum, area) => 
        sum + Math.pow(area - tierMean, 2), 0
      ) / tiers[i].length;
      withinVarSum += tierVar;
    }
    const withinVar = withinVarSum / tierCount;
    
    const fRatio = withinVar > 0.0001 ? betweenVar / withinVar : 0;
    coherence = Math.min(1.0, fRatio / 5);
  }
  
  // === Component 2: Spread Penalty ===
  // Adaptive limit: scales with sqrt(photoCount / 10)
  // 10 photos → 15:1, 40 photos → 30:1, 90 photos → 45:1
  const adaptiveLimit = tuning.tier_baseSpreadLimit * Math.sqrt(photoCount / 10);
  const spreadRatio = smallest > 0 ? largest / smallest : Infinity;
  
  // Penalty ramps up when spreadRatio exceeds adaptiveLimit
  // At 2x the limit, penalty = 0.3 (significant but not fatal)
  const spreadPenalty = spreadRatio <= adaptiveLimit 
    ? 0 
    : Math.min(0.4, (spreadRatio - adaptiveLimit) / adaptiveLimit * 0.3);
  
  const score = Math.max(0.1, coherence - spreadPenalty);
  
  return { score, coherence, spreadRatio, spreadPenalty };
}
```

### 3. Include Hero in Scoring

**File: `src/lib/v4/index.ts`**

Update candidate scoring (around lines 210-214):

```typescript
// BEFORE (line 211):
const allAreas = [...besideAreas, ...belowResult.cells.map(c => c.width * c.height)];
const coherenceScore = tierCoherenceScore(allAreas);
const presenceScore = besideCount > 0 ? 1.0 : 0.4;
const score = (coherenceScore * 0.7) + (presenceScore * 0.3);

// AFTER:
// Include hero in balance scoring - this is the key fix!
const allAreas = [heroArea, ...besideAreas, ...belowResult.cells.map(c => c.width * c.height)];
const balanceResult = scoreCellBalance(allAreas, allAreas.length, tuning);
const presenceScore = besideCount > 0 ? 1.0 : 0.4;
const score = (balanceResult.score * 0.7) + (presenceScore * 0.3);
```

---

## Expected Scoring Behavior

### Test Matrix: Scoring Outcomes by Layout Type

| Layout | Photos | Hero % | Smallest % | Spread | Adaptive Limit | Coherence | Spread Penalty | Final Score |
|--------|--------|--------|------------|--------|----------------|-----------|----------------|-------------|
| Balanced | 10 | 25% | 3% | 8:1 | 15:1 | 0.85 | 0.00 | 0.70 |
| Balanced | 24 | 30% | 2% | 15:1 | 23:1 | 0.80 | 0.00 | 0.66 |
| Moderate | 24 | 40% | 1% | 40:1 | 23:1 | 0.75 | 0.15 | 0.50 |
| Extreme | 24 | 55% | 0.5% | 110:1 | 23:1 | 0.70 | 0.40 | 0.30 |
| Balanced | 54 | 28% | 0.8% | 35:1 | 35:1 | 0.82 | 0.00 | 0.67 |
| Extreme | 54 | 68% | 0.5% | 136:1 | 35:1 | 0.68 | 0.40 | 0.28 |

### Visual Diagram: Spread Penalty Curve

```text
Penalty
  0.4 │                    ┌──────────────
      │                   /
  0.3 │                  /
      │                 /
  0.2 │                /
      │               /
  0.1 │              /
      │             /
    0 │────────────┘
      └────┬───────┬───────┬───────┬─────
           1x      2x      3x      4x
                Spread / Adaptive Limit
```

---

## Why This is Future-Proof

### Multi-Hero Support

With 2+ heroes, the scoring function still works:

```typescript
const allAreas = [hero1Area, hero2Area, ...besideAreas, ...belowAreas];
const balanceResult = scoreCellBalance(allAreas, allAreas.length, tuning);
```

No changes needed - it just evaluates whatever cells you give it.

### Nested Regions

If you pack a sub-region and want to score it independently:

```typescript
const subRegionCells = packToFillWidth(photos, width, gap, rows, tuning);
const subAreas = subRegionCells.cells.map(c => c.width * c.height);
const subScore = scoreCellBalance(subAreas, subAreas.length, tuning);
```

The function is a pure "lego brick" - no semantic assumptions.

---

## Summary of Changes

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src/lib/v3/types.ts` | +3 | Add `tier_baseSpreadLimit` to interface and defaults |
| `src/lib/v4/index.ts` | ~50 | Replace `tierCoherenceScore` with `scoreCellBalance`, include hero in `allAreas` |

**Root Cause Fixed**: Hero was excluded from scoring, allowing it to dominate unchecked.

**New Capability**: Adaptive spread penalty that scales with photo count, preventing crushed layouts at any scale.


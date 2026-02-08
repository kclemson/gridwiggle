

# Tier Coherence Scoring: F-ratio Test Matrix

## The Core Idea

**F-ratio** measures how well areas cluster into distinct groups:

```text
F = (Between-tier variance) / (Within-tier variance)
```

- **High F**: Clear tiers (e.g., 1 large hero, 5 medium, 20 small) - areas are tightly grouped with distinct separation
- **Low F**: Either too uniform (all same size) OR too chaotic (random sizes everywhere)

This single metric replaces uniformity + parity with one that *rewards* hierarchy rather than penalizing it.

---

## Algorithm Walkthrough

```text
Input: [0.25, 0.22, 0.08, 0.07, 0.06, 0.05, 0.04, 0.04, 0.03, 0.03] (cell areas as % of canvas)

Step 1: Sort descending (already done)

Step 2: Split into K=3 equal-sized tiers
  Tier 1 (Large):  [0.25, 0.22, 0.08]     → mean = 0.183
  Tier 2 (Medium): [0.07, 0.06, 0.05]     → mean = 0.060  
  Tier 3 (Small):  [0.04, 0.04, 0.03, 0.03] → mean = 0.035

Step 3: Calculate grand mean
  grandMean = (0.25+0.22+...+0.03) / 10 = 0.087

Step 4: Between-tier variance (how spread apart are tier means?)
  betweenVar = [(0.183-0.087)² + (0.060-0.087)² + (0.035-0.087)²] / 3
             = [0.0092 + 0.0007 + 0.0027] / 3 = 0.0042

Step 5: Within-tier variance (how scattered within each tier?)
  withinVar_1 = [(0.25-0.183)² + (0.22-0.183)² + (0.08-0.183)²] / 3 = 0.0056
  withinVar_2 = [(0.07-0.06)² + (0.06-0.06)² + (0.05-0.06)²] / 3 = 0.00007
  withinVar_3 = [(0.04-0.035)² + ...] / 4 = 0.00003
  withinVar = average of above = 0.0019

Step 6: F-ratio
  F = betweenVar / withinVar = 0.0042 / 0.0019 = 2.2

Step 7: Normalize to 0-1 score
  score = min(1.0, F / 5) = 0.44
```

---

## Test Matrix: Expected F-ratio Scores

### Scenario A: Landscape Hero (AR 1.73), 46 photos

| besideCount | Area Distribution Pattern | Expected F | Score | Why |
|-------------|---------------------------|------------|-------|-----|
| 0 | All 45 content similar size | ~0.5 | 0.10 | No hierarchy - too uniform |
| 2 | Hero huge, 2 small beside, 43 medium below | ~1.5 | 0.30 | Weak hierarchy - 2 cells don't form a tier |
| 4 | Hero + 4 beside (small), 41 below (medium) | ~2.5 | 0.50 | Emerging 3-tier structure |
| 8 | Hero, 8 beside (small), 37 below (medium-large) | ~4.0 | 0.80 | Clear 3-tier hierarchy |
| 12 | Hero, 12 beside (very small), 33 below (large) | ~3.5 | 0.70 | Good but beside gets cramped |
| 16 | Hero, 16 beside (tiny), 29 below (huge) | ~2.5 | 0.50 | Too extreme - within-tier variance rises |

**Sweet spot: 6-10 beside** - creates distinct Large/Medium/Small tiers without extremes

### Scenario B: Portrait Hero (AR 0.6), 46 photos

| besideCount | Area Distribution Pattern | Expected F | Score | Why |
|-------------|---------------------------|------------|-------|-----|
| 0 | Hero + 45 content uniform | ~0.8 | 0.16 | Hero alone creates weak hierarchy |
| 3 | Hero, 3 beside (small), 42 below | ~2.0 | 0.40 | Modest 3-tier |
| 6 | Hero, 6 beside (small), 39 below | ~3.5 | 0.70 | Good balance |
| 10 | Hero, 10 beside (cramped), 35 below | ~3.0 | 0.60 | Beside getting squished |
| 14 | Hero, 14 beside (very cramped), 31 below | ~2.0 | 0.40 | Beside tier too uniform-tiny |

**Sweet spot: 4-8 beside** - portrait heroes have less width for beside, so fewer fit naturally

### Scenario C: Square Hero (AR 1.0), 20 photos

| besideCount | Area Distribution Pattern | Expected F | Score | Why |
|-------------|---------------------------|------------|-------|-----|
| 0 | Hero + 19 uniform | ~0.6 | 0.12 | Weak - hero alone |
| 2 | Hero, 2 beside, 17 below | ~1.8 | 0.36 | Emerging hierarchy |
| 4 | Hero, 4 beside, 15 below | ~3.2 | 0.64 | Good 3-tier |
| 6 | Hero, 6 beside, 13 below | ~3.8 | 0.76 | Strong hierarchy |
| 8 | Hero, 8 beside, 11 below | ~3.0 | 0.60 | Below tier getting thin |

**Sweet spot: 4-7 beside**

### Scenario D: Wide Hero (AR 2.5), 30 photos

| besideCount | Area Distribution Pattern | Expected F | Score | Why |
|-------------|---------------------------|------------|-------|-----|
| 0 | Hero + 29 uniform | ~0.4 | 0.08 | Very flat |
| 4 | Hero, 4 beside, 25 below | ~2.2 | 0.44 | Emerging |
| 8 | Hero, 8 beside, 21 below | ~4.2 | 0.84 | Strong - wide hero leaves room |
| 12 | Hero, 12 beside, 17 below | ~4.5 | 0.90 | Excellent 3-tier |
| 16 | Hero, 16 beside, 13 below | ~3.5 | 0.70 | Below tier too small |

**Sweet spot: 8-14 beside** - wide heroes can accommodate more beside naturally

### Scenario E: Low Photo Count (10 photos)

| Hero AR | besideCount | Area Distribution | Expected F | Score |
|---------|-------------|-------------------|------------|-------|
| 1.73 | 0 | Hero + 9 uniform | ~0.5 | 0.10 |
| 1.73 | 2 | Hero, 2, 7 | ~2.5 | 0.50 |
| 1.73 | 4 | Hero, 4, 5 | ~3.5 | 0.70 |
| 0.6 | 0 | Hero + 9 uniform | ~0.6 | 0.12 |
| 0.6 | 2 | Hero, 2, 7 | ~2.2 | 0.44 |
| 0.6 | 4 | Hero, 4, 5 | ~2.8 | 0.56 |

---

## Why This Works for Multi-Hero

The F-ratio operates on **all cell areas across the canvas** regardless of which region they came from:

```text
Future: Hero1 + Beside1 + Hero2 + Beside2 + Below
        ↓
All areas fed into F-ratio together
        ↓
Rewards distinct size tiers across entire composition
```

No comparison of "beside count vs total" - just pure area distribution analysis.

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| All photos same AR | F-ratio rewards layouts that create size variety through row structure |
| Very mixed ARs (0.5-2.5) | Natural variety → F-ratio less critical, most configs score OK |
| 2 photos only | Not enough for tiers → fallback scoring or skip F-ratio |
| 50+ photos | More cells = more reliable tier detection |

---

## Implementation

### File: `src/lib/v3/region-search.ts`

Replace `scoreRegionAssignment()` with:

```typescript
/**
 * Calculate tier coherence (F-ratio) for cell areas.
 * Measures how well areas cluster into distinct size tiers.
 * 
 * High F = clear hierarchy (good for hero layouts)
 * Low F = too uniform OR too chaotic
 */
function tierCoherenceScore(areas: number[], tierCount: number = 3): number {
  if (areas.length < tierCount * 2) {
    // Not enough cells for meaningful tiers - neutral score
    return 0.5;
  }
  
  const sorted = [...areas].sort((a, b) => b - a);
  const grandMean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  
  // Split into equal-sized tiers
  const tierSize = Math.ceil(sorted.length / tierCount);
  const tiers: number[][] = [];
  for (let i = 0; i < tierCount; i++) {
    tiers.push(sorted.slice(i * tierSize, (i + 1) * tierSize));
  }
  
  // Calculate tier means
  const tierMeans = tiers.map(tier => 
    tier.reduce((a, b) => a + b, 0) / tier.length
  );
  
  // Between-tier variance: how spread apart are the tier means?
  const betweenVar = tierMeans.reduce((sum, mean) => 
    sum + Math.pow(mean - grandMean, 2), 0
  ) / tierCount;
  
  // Within-tier variance: how scattered within each tier?
  let withinVarSum = 0;
  for (let i = 0; i < tierCount; i++) {
    const tierMean = tierMeans[i];
    const tierVar = tiers[i].reduce((sum, area) => 
      sum + Math.pow(area - tierMean, 2), 0
    ) / tiers[i].length;
    withinVarSum += tierVar;
  }
  const withinVar = withinVarSum / tierCount;
  
  // F-ratio (protect against division by zero)
  const fRatio = withinVar > 0.0001 ? betweenVar / withinVar : 0;
  
  // Normalize: F of 5+ → score 1.0
  return Math.min(1.0, fRatio / 5);
}

function scoreRegionAssignment(
  _heroAR: number,
  besideResult: { cells: { width: number; height: number }[]; width: number; height: number },
  belowResult: { cells: { width: number; height: number }[]; width: number; height: number },
  _normalizedGap: number,
  _tuning: V3Tuning
): number {
  // Collect all cell areas
  const allAreas = [
    ...besideResult.cells.map(c => c.width * c.height),
    ...belowResult.cells.map(c => c.width * c.height),
  ];
  
  // Tier coherence: reward distinct size hierarchy
  const coherenceScore = tierCoherenceScore(allAreas);
  
  // Beside presence: still want to avoid 0-beside dominating
  const presenceScore = besideResult.cells.length > 0 ? 1.0 : 0.3;
  
  // Combined: coherence (70%) + presence (30%)
  return (coherenceScore * 0.70) + (presenceScore * 0.30);
}
```

---

## Summary

| Aspect | Old Scoring | New Scoring |
|--------|-------------|-------------|
| Metric count | 3 (uniformity, parity, presence) | 2 (coherence, presence) |
| Hierarchy | Penalized (uniformity fought it) | Rewarded (F-ratio rewards tiers) |
| Multi-hero ready | No (compared beside to total) | Yes (pure area distribution) |
| Landscape hero support | Poor (0-beside won) | Good (6-10 beside wins) |


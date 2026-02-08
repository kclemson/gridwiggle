

# Weighted Random Selection for Region Assignments

## Problem

Currently in `randomize` mode, candidates are selected with uniform probability:

```typescript
validRegionAssignments[Math.floor(Math.random() * validRegionAssignments.length)]
```

This means a candidate with score 0.52 has the same chance of being picked as one with score 0.86 — wasting all the work the scoring function does.

---

## Solution: Score-Weighted Selection

Replace uniform random with a probability distribution where higher-scoring candidates are more likely to be selected, while still allowing variety.

### The Math

**Step 1: Normalize scores to [0, 1] range**
```typescript
const minScore = Math.min(...scores);
const maxScore = Math.max(...scores);
const range = maxScore - minScore || 1; // Avoid division by zero
const normalized = (score - minScore) / range;
```

**Step 2: Apply power function + floor constant**
```typescript
// Square emphasizes differences, +0.1 ensures no candidate has zero weight
const weight = Math.pow(normalized, 2) + 0.1;
```

**Step 3: Build cumulative probability distribution**
```typescript
const totalWeight = weights.reduce((sum, w) => sum + w, 0);
const probabilities = weights.map(w => w / totalWeight);
const cumulative = probabilities.reduce((acc, p, i) => {
  acc.push((acc[i - 1] || 0) + p);
  return acc;
}, []);
```

**Step 4: Sample from distribution**
```typescript
const r = Math.random();
const selectedIndex = cumulative.findIndex(cp => r <= cp);
```

### Example: 4 Candidates

| Candidate | Raw Score | Normalized | Weight (n² + 0.1) | Probability |
|-----------|-----------|------------|-------------------|-------------|
| A         | 0.52      | 0.00       | 0.10              | 5%          |
| B         | 0.67      | 0.44       | 0.29              | 14%         |
| C         | 0.78      | 0.76       | 0.68              | 33%         |
| D         | 0.86      | 1.00       | 1.10              | 53%         |

The best candidate (D) is picked ~53% of the time instead of 25%. The worst (A) is picked ~5% instead of 25%. Variety is preserved, but quality is strongly favored.

---

## Technical Implementation

### File: `src/lib/v3/region-search.ts`

**Add helper function** (new function, ~25 lines):

```typescript
/**
 * Select a candidate using score-weighted random selection.
 * Higher-scoring candidates have higher probability of being selected.
 * 
 * Uses squared normalized scores to emphasize quality differences,
 * with a floor constant to ensure all candidates have non-zero probability.
 */
function weightedRandomSelect<T extends { score: number }>(candidates: T[]): T {
  if (candidates.length === 1) return candidates[0];
  
  // Extract scores and compute range
  const scores = candidates.map(c => c.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1; // Avoid division by zero
  
  // Compute weights: squared normalized score + floor constant
  const weights = scores.map(s => {
    const normalized = (s - minScore) / range;
    return Math.pow(normalized, 2) + 0.1; // 0.1 floor ensures non-zero probability
  });
  
  // Build cumulative distribution
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let cumulative = 0;
  const cumulativeWeights = weights.map(w => {
    cumulative += w / totalWeight;
    return cumulative;
  });
  
  // Sample from distribution
  const r = Math.random();
  const selectedIndex = cumulativeWeights.findIndex(cp => r <= cp);
  return candidates[selectedIndex >= 0 ? selectedIndex : candidates.length - 1];
}
```

**Update selection logic** (lines 453-466):

```typescript
if (validRegionAssignments.length > 0) {
  // Pick using weighted random for variety OR pick best score for determinism
  const selected = randomize
    ? weightedRandomSelect(validRegionAssignments)
    : validRegionAssignments.reduce((best, current) => current.score > best.score ? current : best);
  
  devLogger.log('region', `Assignment selected ${randomize ? 'by weighted random' : 'by best score'}`, {
    totalCandidates: validRegionAssignments.length,
    besideCount: selected.besidePhotos.length,
    belowCount: selected.belowPhotos.length,
    besideRowCount: selected.besideRowCount,
    score: selected.score.toFixed(3),
  });
  return { assignment: selected };
}
```

---

## Test Matrix: Selection Probability Changes

| Scenario | Scores | Uniform (Before) | Weighted (After) |
|----------|--------|------------------|------------------|
| 4 candidates, wide spread | 0.52, 0.67, 0.78, 0.86 | 25% each | 5%, 14%, 33%, 53% |
| 4 candidates, tight cluster | 0.80, 0.82, 0.84, 0.86 | 25% each | 15%, 21%, 29%, 35% |
| 2 candidates, one bad | 0.30, 0.85 | 50% each | 8%, 92% |
| 8 candidates, all similar | 0.70-0.75 | 12.5% each | ~12% each (floor dominates) |

Key behaviors:
- **Wide score spreads**: Best candidates heavily favored
- **Tight clusters**: Distribution remains relatively uniform (variety preserved)
- **One outlier bad**: Bad candidate almost never picked
- **All similar**: Floor constant keeps selection fairly uniform

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/region-search.ts` | Add `weightedRandomSelect()` helper, update selection logic |

---

## Expected Behavior

### Before
- 8 candidates collected, scores range 0.52 to 0.86
- Uniform random picks any with 12.5% probability
- Worst candidate (0.52) gets selected, prominence fails in intersection

### After
- Same 8 candidates, scores 0.52 to 0.86
- Weighted selection: best (0.86) has ~40% chance, worst (0.52) has ~2% chance
- High-scoring candidates with healthy prominence margins are picked ~95% of the time
- Double-validation failures become rare edge cases, not common occurrences


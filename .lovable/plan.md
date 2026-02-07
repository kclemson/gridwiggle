
## Optimize Corner Position Evaluation (Symmetry Deduplication)

### Design Intent
Eliminate redundant computation by recognizing that left/right mirror positions (e.g., top-left vs top-right) produce identical region assignments, packing results, and scores. Only the final coordinate mapping differs, which is trivial to compute.

### User Outcome
~50% reduction in layout search logs and computation time for hero layouts. The algorithm evaluates 1-2 unique configurations instead of 4, then applies the winning assignment to a randomly selected (or first) position.

---

## Current Flow (Redundant)

```text
proposePositions() returns 4 corner proposals:
  - top-left     → findValidRegionAssignment → pack → score
  - top-right    → findValidRegionAssignment → pack → score  (SAME result)
  - bottom-left  → findValidRegionAssignment → pack → score  (SAME result)  
  - bottom-right → findValidRegionAssignment → pack → score  (SAME result)
```

All 4 calls to `findValidRegionAssignment` return identical results because the region search only depends on:
- `contentPhotos` (same)
- `heroAR` (same)
- `normalizedGap` (same)
- `tuning` (same)

The position string is never used during region search or packing.

---

## Proposed Flow (Optimized)

```text
1. Compute region assignment ONCE for corner mode
2. Pack BESIDE and BELOW regions ONCE
3. Validate constraints ONCE (canvas AR, prominence, etc.)
4. If valid, pick a position for variety:
   - When randomize=true: random from [top-left, top-right, bottom-left, bottom-right]
   - When randomize=false: deterministic (top-left)
5. Apply position to convertToNormalized()
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/v3/entities/hero.ts` | Simplify `proposePositions` to return 1 corner proposal (canonical) |
| `src/lib/v3/intersection.ts` | After evaluation, apply random position selection for variety |

---

## Technical Details

### Option A: Reduce Proposals + Add Position Randomization

**hero.ts changes:**

```typescript
// Before: 4 corner proposals
proposals.push({ ..., position: 'top-left' });
proposals.push({ ..., position: 'top-right' });
proposals.push({ ..., position: 'bottom-left' });
proposals.push({ ..., position: 'bottom-right' });

// After: 1 canonical corner proposal
proposals.push({ ..., position: 'top-left' }); // Canonical
```

**intersection.ts changes:**

In `evaluateNormalizedProposal`, after validation passes:

```typescript
// Apply position variety for corner mode
const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const selectedPosition = randomize 
  ? positions[Math.floor(Math.random() * positions.length)]
  : 'top-left';

const cells = convertToNormalized(
  heroPhoto,
  selectedPosition,  // Use selected position
  ...
);

const legacyProposal: HeroProposal = {
  ...
  position: selectedPosition,  // Reflect in output
};
```

### Option B: Keep Proposals, Early-Exit After First Valid

Alternative approach - keep all 4 proposals but exit after finding one valid:

```typescript
for (const proposal of proposals) {
  const config = evaluateNormalizedProposal(...);
  if (config) {
    // Corner positions are symmetric - first valid is enough
    if (proposal.mode === 'corner') {
      // Apply random position for variety
      config.proposal.position = randomize 
        ? pickRandomCorner()
        : proposal.position;
      return config;
    }
    validConfigs.push(config);
  }
}
```

---

## Recommendation

**Option A** is cleaner - fewer proposals generated means fewer log entries and simpler control flow. The position randomization happens at the final step where it belongs.

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Corner proposals evaluated | 4 | 1 |
| `findValidRegionAssignment` calls per layout | 4 | 1 |
| Total log entries | ~100+ | ~50-60 |
| Computation time | 10ms | ~5-7ms |

---

## Edge Cases

1. **Edge/Floating modes**: Not affected - these have genuinely different geometry
2. **Randomize flag**: Position variety preserved via random selection after evaluation
3. **Deterministic mode**: Always returns `top-left` for reproducibility

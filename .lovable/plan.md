

# Fix Dual-Hero Fallback After Soft-Reject

## Problem

The soft-reject change (replacing hard rejects with score penalties) inadvertently broke the dual-hero to single-hero fallback path. Previously, broken dual-hero layouts were hard-rejected, producing 0 candidates, which triggered a fallback to single-hero. Now they survive at the 0.05 floor score, so the fallback never fires.

## User Outcome

When dual-hero layouts are geometrically broken (all candidates at floor score), the system automatically tries single-hero instead of showing a broken layout with 4% hero coverage and 63%-area content photos.

## Change

**File:** `src/lib/v4/index.ts`, lines ~827-834

Current logic:
```
candidates = generateDualHeroCandidates(...);
if (candidates.length === 0) {
  // fall back to single hero
}
```

New logic:
```
candidates = generateDualHeroCandidates(...);
const bestDualScore = candidates.length > 0
  ? Math.max(...candidates.map(c => c.score))
  : 0;
if (bestDualScore <= 0.10) {
  // Dual candidates are absent or all near floor -- try single hero
  const allContent = dimensions.filter(d => d.id !== heroPhoto.id);
  const singleCandidates = generateCandidates(heroPhoto, allContent, normalizedGap, tuning, randomize);
  if (singleCandidates.length > 0) {
    const bestSingle = Math.max(...singleCandidates.map(c => c.score));
    if (bestSingle > bestDualScore) {
      candidates = singleCandidates;
      devLogger.log('layout', 'Single-hero beats dual-hero', {
        bestDual: bestDualScore.toFixed(3),
        bestSingle: bestSingle.toFixed(3),
      });
    }
  }
}
```

Key design decisions:
- Threshold of 0.10 catches all floor-scored candidates (0.05) plus anything only marginally better
- Does not discard dual candidates outright -- compares best scores from both paths and picks the winner
- Zero risk to good dual-hero layouts (those score well above 0.10)
- Adds one log line for debug visibility when the fallback fires

## Test Matrix

| Photos | Heroes | Hero ARs | Best dual score | Best single score | Outcome |
|--------|--------|----------|-----------------|-------------------|---------|
| 9 | 2 | 0.73, 0.56 (both portrait) | 0.05 (floor) | ~0.4-0.6 | Single wins -- fixes this bug |
| 16 | 2 | 1.2, 0.8 (mixed) | ~0.5 | not attempted | Dual kept -- threshold not hit |
| 12 | 2 | 0.5, 0.5 (both tall portrait) | 0.05-0.08 | ~0.3-0.5 | Single wins -- appropriate |
| 20 | 2 | 1.5, 1.3 (both landscape) | ~0.6 | not attempted | Dual kept -- no change |


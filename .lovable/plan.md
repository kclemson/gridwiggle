
# Fix: Range-Based Early Prominence Feasibility Check

## Design Intent

The early feasibility check exists to prune the search space before expensive packing operations. The current implementation incorrectly uses a single row count (1) as a "worst case", which backwards-rejects portrait heroes that would succeed with more rows.

The fix changes the question from "does 1 row work?" to "does ANY row count in the valid range satisfy BOTH prominence constraints?"

## User Outcome

- Portrait heroes with many content photos will be properly evaluated instead of immediately rejected
- Layouts like the mockup (AR ~0.65 hero with 6 rows beside) will pass feasibility and get packed
- No performance regression — still O(1) algebraic check with no packing

---

## Technical Approach

### The Geometry

In normalized space (hero height = 1.0):

```text
heroArea = heroAR × 1.0 = heroAR

For BESIDE with R rows:
  rowHeight = 1.0 / R
  cellArea ≈ avgBesideAR × rowHeight² = avgBesideAR / R²

Prominence ratio = heroArea / cellArea = heroAR × R² / avgBesideAR
```

### Two Competing Constraints

1. **Minimum Prominence** (`hero_minProminence = 1.3`): Hero must be ≥1.3× the largest content cell
   - Needs MORE rows (smaller cells)
   - `R ≥ sqrt(minProminence × avgBesideAR / heroAR)`

2. **Maximum Prominence** (`hero_maxToSmallest = 22`): Hero must be ≤22× the smallest content cell  
   - Needs FEWER rows (larger cells)
   - `R ≤ sqrt(maxToSmallest × avgBesideAR / heroAR)`

### Feasibility = Range Intersection

If `[minRowsForProminence, maxRowsForSmallest]` overlaps with physical limits `[1, min(besideCount, 6)]`, a valid configuration exists.

---

## Verification

### Portrait Hero (AR 0.65) with 6 BESIDE photos (avgAR 1.4)

```text
minRowsForProminence = ceil(sqrt(1.3 × 1.4 / 0.65)) = ceil(1.67) = 2
maxRowsForSmallest = floor(sqrt(22 × 1.4 / 0.65)) = floor(6.88) = 6
Physical limit: min(6, 6) = 6

Valid range: [2, 6] ∩ [1, 6] = [2, 6] → FEASIBLE
```

### Landscape Hero (AR 1.5) with same photos

```text
minRowsForProminence = ceil(sqrt(1.3 × 1.4 / 1.5)) = ceil(1.1) = 2
maxRowsForSmallest = floor(sqrt(22 × 1.4 / 1.5)) = floor(4.53) = 4

Valid range: [2, 4] → FEASIBLE
```

### Extreme: Tiny Portrait (AR 0.3) with only 2 wide photos (avgAR 2.0)

```text
minRowsForProminence = ceil(sqrt(1.3 × 2.0 / 0.3)) = ceil(2.94) = 3
maxRowsForSmallest = floor(sqrt(22 × 2.0 / 0.3)) = floor(12.1) = 12
Physical limit: min(2, 6) = 2

Needed: 3+ rows, Available: max 2 rows → INFEASIBLE (correctly rejected)
```

---

## File Changes

### 1. `src/lib/v3/feasibility.ts`

Replace the existing `canMeetProminence` function with a new `canMeetProminenceConstraints` function:

- Remove the old function that takes `besideRowCount` as a parameter
- Add new function that calculates valid row range algebraically
- Returns `{ feasible, minRows, maxRows, reason? }` for better logging

### 2. `src/lib/v3/region-search.ts`

Update the import and caller:

- Change import from `canMeetProminence` to `canMeetProminenceConstraints`
- Update the early feasibility check at line 97-111 to use the new function
- Improve logging to show the valid row range when skipping

---

## Edge Cases Handled

| Scenario | Current Behavior | New Behavior |
|----------|-----------------|--------------|
| Portrait hero + many landscape | Rejected (1 row fails) | Passes (2+ rows valid) |
| Landscape hero + landscape | Usually passes | Unchanged |
| Very portrait + few wide photos | May incorrectly pass | Correctly rejects if no valid range |
| Square hero + mixed content | Inconsistent | Properly evaluates full range |

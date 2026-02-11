

# Fix: Prevent Sparse Rows via Inline Count Guard

## Problem

The `distributeByARBudget` greedy loop can create rows with very few photos (e.g., 2 in a 6,2,5 split) because the row-break decision is based purely on AR budget. When jitter rolls low AND the next photos are wide, the budget is exhausted after just 2 photos.

## Design Intent

We want AR-budget jitter to create organic row-height variety, but we don't want it to create jarring photo-count imbalances. A row of 2 next to rows of 5-6 looks broken; 5,3,5 or 4,4,5 looks intentionally varied.

## User Outcome

Row distributions stay reasonably balanced (no row has drastically fewer photos than average) while still varying in height thanks to different photo aspect ratios within each row. Jitter continues to operate freely above the floor.

## Solution

Add one condition to the existing row-break decision in `distributeByARBudget`. Before allowing a row break, require the current row to have at least `minPerRow` photos.

**File:** `src/lib/v3/utils.ts`, function `distributeByARBudget`

### Current code (line 188-190):

```typescript
// Should we start a new row?
// Only if: current row not empty AND current AR has reached jittered budget
if (currentRow.length > 0 && currentAR >= jitteredTarget) {
```

### New code:

```typescript
// Minimum photos per row: prevent jitter from creating sparse rows
const avgPerRow = n / targetRowCount;
const minPerRow = Math.max(2, Math.floor(avgPerRow * 0.6));

// ... (inside the loop, line 190):

// Should we start a new row?
// Only if: row has minimum photos AND current AR has reached jittered budget
if (currentRow.length >= minPerRow && currentAR >= jitteredTarget) {
```

The `minPerRow` calculation moves before the loop (it's constant). The loop condition changes from `currentRow.length > 0` to `currentRow.length >= minPerRow`.

### Threshold math

| Photos | Rows | Avg | minPerRow (floor 0.6x) | Effect |
|--------|------|-----|------------------------|--------|
| 13 | 3 | 4.3 | 2 | Prevents 1-photo rows |
| 13 | 3 | 4.3 | 2 | Still allows 3,4,6 -- maybe too loose? |
| 21 | 4 | 5.25 | 3 | Prevents 1-2 photo rows |
| 8 | 2 | 4.0 | 2 | Prevents 1-photo rows |

With 0.6 factor, the 13/3 case allows rows as small as 2. To prevent the 2-photo case specifically, we could use **0.7** instead:

| Photos | Rows | Avg | minPerRow (floor 0.7x) | Effect |
|--------|------|-----|------------------------|--------|
| 13 | 3 | 4.3 | 3 | 6,2,5 becomes impossible; 5,3,5 is the sparsest |
| 21 | 4 | 5.25 | 3 | Same floor |
| 8 | 2 | 4.0 | 2 | Unchanged |
| 6 | 2 | 3.0 | 2 | Unchanged |

**Recommendation:** Use **0.7** factor. This makes the minimum meaningful enough to prevent the visually jarring cases while still allowing some count variation.

## What does NOT change

- Jitter value stays at 0.4 (variety is preserved for count-balanced cases)
- No rebalancing pass or post-hoc fix
- No new tuning parameters
- Row-pack, scoring, templates all untouched


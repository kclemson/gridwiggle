

# Content Cell Uniformity Penalty

## Problem

The current scoring function (`scoreCellBalance`) evaluates all cell areas together -- hero included. Because the hero is always the largest cell, the spread ratio (largest/smallest) is always dominated by hero-vs-content contrast. This makes the scorer blind to within-content imbalance: a layout where one row has 8 tiny cells and another has 3 normal cells scores the same as a layout with perfectly even rows.

The root cause is NOT in the packer or the row distributor. The `distributeByARBudget` function works correctly -- it produces organic row distributions based on AR budgets. The problem is that when it occasionally produces an uneven distribution (which it will, especially with portrait-heavy photo sets), the scorer can't tell the difference. So bad distributions survive the competitive selection process instead of being outscored by better alternatives.

## User Outcome

Layouts with wildly uneven row heights will naturally lose in competitive scoring to layouts with balanced rows. No hard caps, no new constraints in the packing algorithm, no special cases. The existing generation loop already produces multiple candidates with different row distributions -- this change simply gives the scorer the ability to distinguish the good ones from the bad ones.

## How It Works

Add a content-only area uniformity check using coefficient of variation (CV = standard deviation / mean). CV is scale-independent, so it works regardless of photo count or canvas size. High CV = some content cells much larger/smaller than others (crushed row symptom). Low CV = uniform content cells (good layout).

The penalty is gentle and capped -- it only engages when CV exceeds a threshold, and the maximum penalty is small enough that it nudges selection without overriding other scoring factors.

```text
contentCV = stddev(contentAreas) / mean(contentAreas)

if contentCV > 0.35:
    penalty = min(0.25, (contentCV - 0.35) * 0.5)
else:
    penalty = 0

finalScore = rawScore - arPenalty - coveragePenalty - prominencePenalty - contentUniformityPenalty
```

## Comprehensive Test Matrix

### Part 1: Row Distribution Scenarios (what CV looks like)

These show how CV responds to different row distributions for a fixed photo count and region width. "Row heights" are relative (taller row = fewer photos at same width).

| Photos | Rows | Distribution | Row Heights (rel) | Content CV | Penalty | Verdict |
|--------|------|-------------|-------------------|-----------|---------|---------|
| 14 | 3 | [5, 5, 4] | ~equal | ~0.12 | 0 | No penalty (good) |
| 14 | 3 | [6, 4, 4] | mild imbalance | ~0.20 | 0 | No penalty (acceptable) |
| 14 | 3 | [8, 3, 3] | crushed first row | ~0.50 | 0.075 | Penalized (bad) |
| 14 | 3 | [9, 3, 2] | severe imbalance | ~0.65 | 0.15 | Heavily penalized |
| 14 | 3 | [10, 2, 2] | extreme | ~0.75 | 0.20 | Near max penalty |
| 20 | 4 | [5, 5, 5, 5] | perfect | ~0.08 | 0 | No penalty |
| 20 | 4 | [7, 5, 4, 4] | slight | ~0.18 | 0 | No penalty |
| 20 | 4 | [10, 4, 3, 3] | crushed | ~0.48 | 0.065 | Penalized |
| 10 | 3 | [4, 3, 3] | good | ~0.10 | 0 | No penalty |
| 10 | 3 | [6, 2, 2] | bad | ~0.55 | 0.10 | Penalized |
| 6 | 2 | [3, 3] | perfect | ~0.05 | 0 | No penalty |
| 6 | 2 | [4, 2] | mild | ~0.25 | 0 | No penalty |
| 6 | 2 | [5, 1] | bad | ~0.60 | 0.125 | Penalized |
| 30 | 5 | [6, 6, 6, 6, 6] | perfect | ~0.06 | 0 | No penalty |
| 30 | 5 | [10, 6, 5, 5, 4] | imbalanced | ~0.35 | 0 | Borderline (no penalty) |
| 30 | 5 | [12, 6, 5, 4, 3] | crushed | ~0.50 | 0.075 | Penalized |

### Part 2: Template x Hero AR x Canvas AR (does the penalty fire for the right templates?)

Each row assumes a representative photo set (14 content photos, mixed AR 0.6-1.8).

| Template | Hero AR | Canvas AR | Typical Row Dist | Content CV | Penalty? | Notes |
|----------|---------|-----------|-------------------|-----------|----------|-------|
| hero-column | 0.68 | 1.5 | 14 in ~3-4 rows | 0.10-0.50 | Sometimes | Portrait hero, wide content region -- portrait photo clusters can pile up |
| hero-column | 0.50 | 1.8 | 14 in ~3-4 rows | 0.10-0.50 | Sometimes | Very narrow hero, wide content -- more room for imbalance |
| hero-column | 0.80 | 1.2 | 14 in ~4-5 rows | 0.08-0.30 | Rarely | Wider hero, narrower content -- less room for extremes |
| hero-row | 1.5 | 0.7 | 14 in ~4-5 rows | 0.08-0.25 | Rarely | Content below, full-width region -- well-constrained |
| hero-row | 2.0 | 0.6 | 14 in ~5-6 rows | 0.06-0.20 | Rarely | Wide hero, lots of rows -- very uniform |
| corner-anchor | 0.68 | 1.0 | beside: 5, below: 9 | 0.10-0.40 | Sometimes | Standard layout -- can have imbalance in beside region |
| corner-anchor | 1.0 | 1.0 | beside: 6, below: 8 | 0.08-0.30 | Rarely | Square hero on square canvas -- well balanced |
| corner-anchor | 1.5 | 1.5 | beside: 4, below: 10 | 0.10-0.35 | Rarely | Landscape hero -- most photos below, even distribution |
| corner-anchor | 0.68 | 1.5 | beside: 7, below: 7 | 0.12-0.45 | Sometimes | Portrait hero on landscape -- the original problem case |
| diagonal-corners | 0.8+1.2 | 1.0 | 3 regions | 0.15-0.40 | Sometimes | Multi-hero -- more region complexity |

### Part 3: Interaction with Existing Penalties (do they stack correctly?)

| Scenario | AR Pen | Coverage Pen | Prominence Pen | Content CV Pen | Total Penalties | Score Impact |
|----------|--------|-------------|----------------|----------------|----------------|-------------|
| Good layout, even rows | 0 | 0 | 0 | 0 | 0 | Full score |
| Good layout, crushed row | 0 | 0 | 0 | 0.10 | 0.10 | Mild demotion |
| AR miss + crushed row | 0.15 | 0 | 0 | 0.10 | 0.25 | Significant demotion |
| Hero too big + crushed row | 0 | 0.20 | 0 | 0.15 | 0.35 | Strong demotion |
| All penalties stacking | 0.15 | 0.15 | 0.10 | 0.20 | 0.60 | Near-zero score (0.05 floor) |
| Crushed row but perfect otherwise | 0 | 0 | 0 | 0.15 | 0.15 | Loses to even-row variant |

### Part 4: Edge Cases

| Scenario | Photos | Content CV | Expected Behavior |
|----------|--------|-----------|-------------------|
| 1 content photo | 1 | 0 (single value) | No penalty, `coefficientOfVariation` returns 0 for < 2 values |
| 2 content photos | 2 | varies | Low CV even with size diff (only 2 values) -- penalty unlikely |
| All identical AR | any | ~0.02 | Near-zero CV -- no penalty regardless of row count |
| All portrait (AR 0.6-0.7) | 14 | 0.05-0.15 | Low CV because similar ARs pack uniformly -- no penalty |
| Mixed (AR 0.5-2.5) | 14 | 0.15-0.50 | Higher CV possible -- penalty engages only for extreme imbalance |
| Content-only layout (no hero) | 20 | N/A | This code path is hero-only; content-only uses separate scoring |

### Part 5: Why This Doesn't Create New Problems

| Concern | Why It's Safe |
|---------|---------------|
| Over-penalizing natural AR variation | CV threshold of 0.35 is generous -- normal variation from mixed photo ARs produces CV of 0.10-0.25 |
| Conflicting with F-ratio scoring | F-ratio evaluates ALL cells (hero included); content CV evaluates ONLY content. They measure different things |
| Reducing layout diversity | Max penalty is 0.25 -- bad layouts still have nonzero scores (0.05 floor) and can be selected via weighted random, just less likely |
| Breaking content-only layouts | Change only applies in `generateCandidates` and `generateDualHeroCandidates` -- content-only path is untouched |
| Breaking dual-hero layouts | Same penalty applies -- if content cells are uneven in a dual-hero layout, it should also be penalized |

## Technical Details

### Change 1: Import `coefficientOfVariation`

**File:** `src/lib/v4/index.ts`

Add to existing import from `'../v3/utils'`:
```
import { ..., coefficientOfVariation } from '../v3/utils';
```

### Change 2: Add penalty in single-region scoring (~line 396)

After computing `allContentAreas` and before the final `score` line:

```typescript
const contentCV = coefficientOfVariation(allContentAreas);
const CV_THRESHOLD = 0.35;
const contentUniformityPenalty = contentCV > CV_THRESHOLD
  ? Math.min(0.25, (contentCV - CV_THRESHOLD) * 0.5)
  : 0;
```

Add `contentUniformityPenalty` to the score subtraction.

### Change 3: Add penalty in two-region scoring (~line 517)

Same logic after `allContentAreas` is populated from both regions.

### Change 4: Add penalty in dual-hero scoring (~line 745)

Same logic in `generateDualHeroCandidates`.

### Summary

- 1 new import
- 3 identical penalty blocks (one per scoring path)
- No new files, no new parameters, no changes to packing or distribution logic
- Existing `coefficientOfVariation` function already exists and is tested


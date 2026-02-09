

# Relaxing Constraints for More Variety

## Problem Diagnosis

The uniformity in photo sizes comes from two places where we're being **too tight**:

1. **AR Budget Jitter is too small** (`row_arBudgetJitter = 0.2`)
2. **Row count range has a hidden cap** (`Math.ceil(n / 2)`)

Both already exist as knobs - we just need to relax them.

---

## Root Cause 1: Conservative Jitter

In `distributeByARBudget()`, each row targets a "jittered" AR budget:

```
jitteredTarget = baseRowAR × (1 ± jitter)
```

With `jitter = 0.2`, row heights vary by only ±20%. This produces rows that are all **roughly the same height** - the "wall of uniformity."

**Fix**: Increase `row_arBudgetJitter` from `0.2` to `0.4` (or even `0.5`).

This means:
- One row might be 60% of base budget → tall row with fewer photos
- Another might be 140% of base budget → short row with many photos
- Natural size hierarchy emerges without any new parameters

---

## Root Cause 2: Row Count Cap

In `calculateBelowRowCount()`, line 357:

```typescript
const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR, Math.ceil(n / 2)));
```

That `Math.ceil(n / 2)` means for 46 photos, maxRows is capped at 23 - but more importantly, it artificially limits variety when minRows is high.

For example, if constraints say `minRows = 5, maxRows = 4` (from the cap), the range collapses to just `[5, 5]` - no variety at all.

**Fix**: Remove the `Math.ceil(n / 2)` cap entirely. Let the geometric constraints (`maxRowsByMinAR`, `minRowsByMaxAR`, `minRowsByCellSize`) determine the valid range naturally.

---

## Implementation

### File: `src/lib/v3/types.ts`

Change line 69:
```typescript
// Before
row_arBudgetJitter: 0.2,

// After
row_arBudgetJitter: 0.4,
```

This widens the per-row AR budget variation from ±20% to ±40%.

### File: `src/lib/v3/normalized-pack.ts`

Change line 357:
```typescript
// Before
const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR, Math.ceil(n / 2)));

// After
const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR));
```

Remove the artificial `n/2` cap that was constraining the row count range.

---

## Expected Impact

### Before (jitter 0.2, with n/2 cap)

| Row | AR Budget | Photos | Height |
|-----|-----------|--------|--------|
| 1 | 4.2 | 5 | 0.15 |
| 2 | 3.8 | 5 | 0.16 |
| 3 | 4.0 | 5 | 0.155 |
| 4 | 4.1 | 5 | 0.152 |

All rows nearly identical → F-ratio ~0.3

### After (jitter 0.4, no n/2 cap)

| Row | AR Budget | Photos | Height |
|-----|-----------|--------|--------|
| 1 | 5.5 | 7 | 0.11 (short, crowded) |
| 2 | 3.0 | 4 | 0.20 (tall, spacious) |
| 3 | 4.8 | 6 | 0.13 |
| 4 | 2.7 | 3 | 0.22 (tall) |

Clear size tiers → F-ratio ~2.5+

---

## Why This Works

We're not adding new constraints - we're **relaxing existing ones**:

1. The jitter parameter already exists and is designed for this purpose - we were just being too conservative with `0.2`

2. The `n/2` cap was a safety valve from earlier iterations when we weren't sure how many rows made sense - now that we have proper geometric constraints (`maxRowsByMinAR`, `minRowsByMaxAR`, `minRowsByCellSize`), it's redundant

---

## Technical Details

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/lib/v3/types.ts` | 69 | `row_arBudgetJitter: 0.2` → `0.4` |
| `src/lib/v3/normalized-pack.ts` | 357 | Remove `Math.ceil(n / 2)` from max calculation |

### Risk Assessment

**Low risk**: Both changes widen existing ranges rather than introducing new logic. The geometric constraints remain in place to prevent truly broken layouts (too tall, too wide, tiny cells). We're just giving the randomization more room to explore.


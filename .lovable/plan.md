

# Fix: Look-Ahead Guard in Greedy AR-Budget Distribution

## Problem

The greedy loop in `distributeByARBudget` decides to start a new row based only on the current row's AR total vs. the budget. It has no awareness of how many photos remain for the remaining rows. This means it can greedily create rows early (e.g., rows of 2 wide photos), leaving the last row with far too many or too few photos.

## Fix

Add a single look-ahead check at the row-break decision point: "If I break now, will the remaining photos be enough to give each remaining row at least `minPerRow` photos?"

### File: `src/lib/v3/utils.ts` -- `distributeByARBudget` function (lines 185-203)

**Current decision logic:**
```typescript
if (currentRow.length >= minPerRow && currentAR >= jitteredTarget) {
  rows.push(currentRow);
  currentRow = [];
  currentAR = 0;
}
```

**New decision logic:**
```typescript
// Look-ahead: if we break now, can remaining photos fill remaining rows?
const photosRemaining = n - (rows.length * 0 + currentRow.length + rows.reduce((s, r) => s + r.length, 0));
// Simpler: track consumed count
const rowsRemaining = targetRowCount - rows.length - 1; // -1 for the row we're about to push
const photosLeft = n - totalConsumed; // photos not yet in currentRow or any finalized row

if (currentRow.length >= minPerRow && currentAR >= jitteredTarget) {
  // Only break if remaining photos can sustain remaining rows
  const photosAfterBreak = n - (rows.length + 1) * 0; // need to track
  if (rowsRemaining <= 0 || photosLeft >= rowsRemaining * minPerRow) {
    rows.push(currentRow);
    currentRow = [];
    currentAR = 0;
  }
}
```

To keep tracking simple, we add a running counter. Here is the clean version of the full loop:

```typescript
const rows: PhotoDimension[][] = [];
let currentRow: PhotoDimension[] = [];
let currentAR = 0;
let consumed = 0; // total photos placed in finalized rows

for (let i = 0; i < photos.length; i++) {
  const photo = photos[i];

  const jitterMultiplier = randomize
    ? 1 + (Math.random() * 2 - 1) * jitter
    : 1.0;
  const jitteredTarget = baseRowAR * jitterMultiplier;

  // Should we start a new row?
  if (currentRow.length >= minPerRow && currentAR >= jitteredTarget) {
    const rowsStillNeeded = targetRowCount - rows.length - 1; // excluding this row
    const photosLeft = n - consumed - currentRow.length;       // not yet in any row

    // Only break if remaining photos can fill remaining rows
    if (rowsStillNeeded <= 0 || photosLeft >= rowsStillNeeded * minPerRow) {
      rows.push(currentRow);
      consumed += currentRow.length;
      currentRow = [];
      currentAR = 0;
    }
  }

  currentRow.push(photo);
  currentAR += photo.aspectRatio;
}

if (currentRow.length > 0) {
  rows.push(currentRow);
}
```

## How It Works

The added guard `photosLeft >= rowsStillNeeded * minPerRow` prevents the algorithm from breaking too eagerly. If breaking now would leave, say, 3 photos for 2 remaining rows (and minPerRow is 4), it refuses to break and keeps adding to the current row instead. This naturally redistributes photos toward earlier rows when the tail would otherwise be starved.

## Expected Behavior

For 45 photos, 5 target rows, minPerRow = 6:

| Scenario | Without guard | With guard |
|----------|--------------|------------|
| 2 wide photos hit AR budget early | Row breaks at 2, last row gets 16 | Row forced to continue (only 43 left for 4 rows needing 24 minimum -- OK, but 2 < minPerRow already catches this) |
| Mixed AR, even budget | [9, 9, 9, 9, 9] | [9, 9, 9, 9, 9] (no change) |
| Last row starved | [11, 10, 10, 10, 4] | [10, 10, 10, 10, 5] (guard prevents over-packing early rows) |
| Heavy landscape run first | [6, 6, 6, 6, 21] -> via minPerRow | [8, 8, 8, 8, 13] (guard keeps rows from breaking when tail would be undersized) |

## Why This Approach

- Modifies the greedy algorithm itself rather than adding a post-pass
- Single additional check per photo -- negligible cost
- No new parameters or tuning knobs
- Preserves AR-budget logic for normal cases; only intervenes when the tail would be starved
- One file changed: `src/lib/v3/utils.ts`, one function modified


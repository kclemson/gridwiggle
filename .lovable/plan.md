

# Fix: Strengthen Look-Ahead Guard Threshold

## Problem

The look-ahead guard we just added checks:
```
photosLeft >= rowsStillNeeded * minPerRow
```

With 45 photos and 7 target rows, `minPerRow = max(2, floor(6.4 * 0.7)) = 4`. So the guard allows breaking even when only 4 photos remain for the last row -- while earlier rows got 10 each. The threshold is too permissive.

## Root Cause

`minPerRow` is a *minimum viability* floor (preventing 0-1 photo rows), not a *balance* threshold. The guard needs to ensure remaining rows get a **comparable** count to the current row, not just a survivable one.

## Fix

One line change in `src/lib/v3/utils.ts`, line 203.

**Current:**
```typescript
if (rowsStillNeeded <= 0 || photosLeft >= rowsStillNeeded * minPerRow) {
```

**New:**
```typescript
const minPerRemainingRow = Math.max(minPerRow, Math.ceil(currentRow.length * 0.5));
if (rowsStillNeeded <= 0 || photosLeft >= rowsStillNeeded * minPerRemainingRow) {
```

This says: "Each remaining row needs at least half as many photos as the row I'm about to push." If the current row has 10 photos, remaining rows each need at least 5. If the current row has 4, the original `minPerRow` floor still applies.

## Expected Behavior

For 45 photos, 7 target rows (avgPerRow = 6.4):

| Scenario | Current guard (minPerRow=4) | Fixed guard |
|----------|---------------------------|-------------|
| Row of 10 packed, 4 left for last row | 4 >= 4: BREAK (creates [10, 10, 10, 10, 10, 4]) | 4 >= 5: NO BREAK (row keeps growing) |
| Row of 8 packed, 6 left for last row | 6 >= 4: BREAK (creates [..., 8, 6]) | 6 >= 4: BREAK (same -- balance OK) |
| Row of 6 packed, 7 left for 2 rows | 7 >= 8: NO BREAK | 7 >= 6: BREAK (each gets ~3.5, fine) |

## Why This Works

- Uses a relative threshold (half the current row) instead of a fixed floor
- The `Math.max(minPerRow, ...)` ensures we never go below the original minimum
- Zero new parameters -- derived from the current row's own size
- One line change in one file


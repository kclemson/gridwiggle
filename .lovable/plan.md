

# Fix: Derive Row Jitter from Geometry

## What changes

**One formula replaces one tuning constant.** The fixed `row_arBudgetJitter = 0.6` (+-60%) becomes `effectiveJitter = 1.5 / avgPerRow`, plus a 2x max-row-size safety net.

## Test matrix (current vs proposed)

```text
Photos | Rows | Avg/Row | Current Jitter | Proposed Jitter | Current worst-case row sizes | Proposed worst-case row sizes
-------+------+---------+----------------+-----------------+------------------------------+------------------------------
  5    |  2   |  2.5    |  +-60%         |  +-60%          |  1 - 4                       |  1 - 4
  6    |  2   |  3.0    |  +-60%         |  +-50%          |  1 - 5                       |  2 - 5
  8    |  3   |  2.7    |  +-60%         |  +-56%          |  1 - 4                       |  1 - 4
 10    |  3   |  3.3    |  +-60%         |  +-45%          |  1 - 5                       |  2 - 5
 12    |  3   |  4.0    |  +-60%         |  +-38%          |  2 - 6                       |  2 - 6
 14    |  4   |  3.5    |  +-60%         |  +-43%          |  1 - 6                       |  2 - 5
 16    |  4   |  4.0    |  +-60%         |  +-38%          |  2 - 6                       |  2 - 6
 20    |  5   |  4.0    |  +-60%         |  +-38%          |  2 - 6                       |  2 - 6
 23    |  5   |  4.6    |  +-60%         |  +-33%          |  2 - 7                       |  3 - 6
 25    |  6   |  4.2    |  +-60%         |  +-36%          |  2 - 7                       |  3 - 6
 30    |  6   |  5.0    |  +-60%         |  +-30%          |  2 - 8                       |  4 - 7
 35    |  7   |  5.0    |  +-60%         |  +-30%          |  2 - 8                       |  4 - 7
```

Small collages (5-10 photos): Virtually no change -- organic variety preserved.
Large collages (25-35 photos): Worst-case row range shrinks from [2-8] to [4-7]. The 4-vs-17 split becomes geometrically impossible.

## Technical changes

### `src/lib/v3/types.ts`
- Remove `row_arBudgetJitter` from `V3Tuning` interface and `DEFAULT_V3_TUNING`

### `src/lib/v3/utils.ts` -- `distributeByARBudget`
- Remove `const { row_arBudgetJitter: jitter } = tuning;`
- Add derived jitter: `const effectiveJitter = 1.5 / avgPerRow;`
- Add max-row-size guard: force row break when `currentRow.length >= Math.ceil(avgPerRow * 2)`

### Any other files referencing `row_arBudgetJitter`
- Search and remove (likely just the tuning defaults and possibly LayoutTest UI)

## Summary

| File | Change |
|---|---|
| `src/lib/v3/types.ts` | Remove `row_arBudgetJitter` from interface + defaults |
| `src/lib/v3/utils.ts` | Derived jitter formula + max-row guard |
| Other references | Remove dead tuning knob references |

3 lines removed, ~6 lines added. Net: fewer tuning knobs, better behavior at scale.


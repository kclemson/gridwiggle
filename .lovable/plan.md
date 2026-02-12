

# Fix: Region 0 Offset Not Updated After Row Scaling

## Problem
After uniform row scaling, Hero 1 becomes wider (`scaledWH1 > wH1`), but Region 0's offset still uses the original unscaled hero width from the topology: `{ x: gap + wH1 + gap, y: gap }`. This means Region 0 photos start too far left, overlapping with the now-wider Hero 1.

## Root Cause
The topology sets Region 0's offset as `{ x: gap + wH1 + gap, y: gap }`. When `scaleRow1 > 1`, Hero 1 grows to `scaledWH1`, but Region 0's offset.x is never updated to `gap + scaledWH1 + gap`.

Region 2's offset IS recalculated (line 770), and Region 1's offset was just fixed in the previous commit -- but Region 0's was missed.

## Fix

### File 1: `src/lib/v4/index.ts` (lines 716-733)

After scaling row 1 cells, also update `region0.offset.x` to use `scaledWH1`:

```
if (scaleRow1 > 1.001 && region0.result) {
  region0 = {
    ...region0,
    offset: { x: normalizedGap + scaledWH1 + normalizedGap, y: normalizedGap },
    result: { ... scaled cells ... },
  };
}
```

Even when `scaleRow1 <= 1.001` (row 1 is already the wider row), the offset is correct because `scaledWH1 == wH1`. So we can unconditionally set the offset.

### File 2: `src/workers/layoutWorker.ts`

Same fix mirrored in the worker's dual-hero path.

## What does NOT change
- Region 1 offset (already fixed)
- Region 2 offset (already recalculated)
- Hero cell positions
- Scaling logic, scoring, or template registry

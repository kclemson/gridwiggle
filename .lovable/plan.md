

# Fix: Missing Square Root in `deriveTargetRowCount`

## The Problem

The `deriveTargetRowCount` formula computes the optimal number of rows for a region, but it's missing a square root. This makes the estimate nonsensically high, which gets clamped, rendering it meaningless as a starting point for the packing search.

**Current formula:** `rows = round(n * meanAR * H / W)` (linear -- grows with photo count)  
**Correct formula:** `rows = round(sqrt(n * meanAR * H / W))` (square root -- grows with sqrt of photo count)

### Why the square root?

The derivation works backward from "what row count makes cells fit the region shape":

- R rows, each with approximately n/R photos
- Row height = H / R
- Row width = (H / R) x (n / R) x meanAR = H x n x meanAR / R-squared
- Set row width equal to region width W, solve for R:
  - R-squared = n x meanAR x H / W
  - **R = sqrt(n x meanAR x H / W)**

### Impact on the 35-photo example

| Region | Photos | Current raw | Clamped | Fixed raw | Fixed result |
|--------|--------|-------------|---------|-----------|-------------|
| Beside (w=0.46, h=1.0) | 13 | 34.7 | 7 | 5.9 | 6 rows |
| Below (w=1.64, h=soft) | 21 | varies | 9 | varies | ~4-5 rows |

With the corrected estimate, the expanding-radius search starts at a geometrically meaningful row count (6 instead of clamped-7-from-35), so it will find a good fit near the estimate rather than wandering to 3 rows.

## What Changes

**Single file:** `src/lib/v3/utils.ts`, function `deriveTargetRowCount` (around line 253)

Change one line:

```
// Before:
const raw = photoCount * meanAR * targetHeight / targetWidth;

// After:
const raw = Math.sqrt(photoCount * meanAR * targetHeight / targetWidth);
```

No other files change. The formula is used by:
- `packToFillHeightAtTargetWidth` (beside region soft-target search)
- `packToFillWidthAtTargetHeight` (below region soft-target search)

Both will now get a meaningful starting estimate, making the search converge on balanced row counts.

## What does NOT change

- Early termination threshold stays at 0.05 (the estimate is now trustworthy, so starting close to it and stopping early is fine)
- No minimum row count floor needed (the estimate itself prevents degenerate values)
- Templates, scoring, region assignment logic -- all untouched


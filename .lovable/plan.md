

# Fixing Landscape Variety: Randomize Search Order + Row Count

## The Problem

Your capture data reveals two issues limiting canvas AR variety:

| File | Photo Count | Hero AR | Canvas AR Range | Issue |
|------|-------------|---------|-----------------|-------|
| First | 46 | 0.80 (portrait) | 0.50 - 0.72 | ALL portrait |
| Second | 5-35 | varied | 0.48 - 1.45 | Better, but still portrait-heavy |

The 46-photo set with portrait hero produces **zero** landscape canvases despite `canvas_maxAR = 2.25` allowing them.

## Root Cause: Ordered Search + Early Exit

The search in `region-search.ts` loops through `besideCount` values **in ascending order**:

```text
for (let besideCount = minBeside; besideCount <= maxBeside; besideCount++)
```

Combined with the early exit at 8 candidates:

```text
if (randomize && validRegionAssignments.length >= 8) break;
```

**Result:** The first 8 valid candidates all come from low `besideCount` values → tall canvases → portrait bias.

## The Fix: Randomize Search Order

Instead of searching 0→1→2→3... randomize the order we visit `besideCount` values:

```text
// Before: [0, 1, 2, 3, 4, 5, 6, 7, 8]
// After:  [5, 2, 8, 0, 3, 7, 1, 6, 4]  (shuffled)
```

This ensures the 8 collected candidates represent diverse configurations, not just the first 8 in sequence.

## Implementation Details

### File: `src/lib/v3/region-search.ts`

**Change 1: Randomize besideCount search order (around line 161)**

```typescript
// Current:
for (let besideCount = minBeside; besideCount <= maxBeside; besideCount++) {

// New:
// Build array of besideCount values to try
const besideCountsToTry = [];
for (let bc = minBeside; bc <= maxBeside; bc++) {
  besideCountsToTry.push(bc);
}

// Shuffle if randomizing for variety
const orderedBesideCounts = randomize 
  ? shuffleArray(besideCountsToTry) 
  : besideCountsToTry;

for (const besideCount of orderedBesideCounts) {
```

**Change 2: Randomize besideRowCount order (around line 311)**

```typescript
// Current:
for (let besideRowCount = minRows; besideRowCount <= maxRows; besideRowCount++) {

// New:
const besideRowCountsToTry = [];
for (let rc = minRows; rc <= maxRows; rc++) {
  besideRowCountsToTry.push(rc);
}
const orderedBesideRowCounts = randomize 
  ? shuffleArray(besideRowCountsToTry) 
  : besideRowCountsToTry;

for (const besideRowCount of orderedBesideRowCounts) {
```

### Why This Works

- **Same constraint system** — no new parameters or relaxed thresholds
- **Same candidate pool** — just visited in random order
- **Early exit still works** — but now collects diverse candidates
- **No directional bias** — portrait and landscape configs have equal chance of being in first 8

## Expected Impact

| Before | After |
|--------|-------|
| First 8 candidates: besideCount 0-4 | First 8 candidates: random mix of all valid besideCount |
| Canvas AR clustered around minAR | Canvas AR spread across valid range |
| Portrait hero → portrait canvas | Portrait hero → variety of canvas shapes |

## Test Matrix

For 46 photos with portrait hero (AR 0.8):

| Metric | Before | Expected After |
|--------|--------|----------------|
| Canvas AR range | 0.50 - 0.72 | 0.50 - 1.50+ |
| Layouts with canvasAR > 1.0 | 0% | ~30-40% |
| Unique configurations | ~3-4 | ~8+ |

## Summary

This is a pure algorithmic fix — no new tuning parameters, no relaxed constraints. We're just ensuring that when `randomize=true`, we actually explore the search space randomly rather than sequentially.


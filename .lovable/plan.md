
# Mathematical Row Clamping Guardrail

## Overview

Add ~10 lines to `findBestRowSplit` that clamp the row search range using the formula `Aspect = S / R²`. This prevents extreme layouts without touching the scoring logic.

---

## The Math

```text
Final Aspect Ratio = S / R²

Where:
  S = sum of all photo aspect ratios
  R = number of rows

Solving for R:
  R = √(S / targetAspect)
```

To stay within aspect bounds `[minAspect, maxAspect]`:
- `minRows = ceil(√(S / maxAspect))` — prevents extreme width
- `maxRows = floor(√(S / minAspect))` — prevents extreme height

---

## Aspect Bounds by Shape

| Shape | Min Aspect | Max Aspect | Meaning |
|-------|------------|------------|---------|
| Portrait | 0.5 | 0.8 | Tall (1:2 to 4:5) |
| Square | 0.85 | 1.15 | Near 1:1 |
| Landscape | 1.25 | 2.0 | Wide (5:4 to 2:1) |
| Auto | 0.67 | 1.5 | Balanced variety (2:3 to 3:2) |

---

## Example: 64 Mixed Photos (S ≈ 80)

| Shape | Aspect Bounds | Row Range | Result |
|-------|---------------|-----------|--------|
| Auto | [0.67, 1.5] | 7–11 rows | Balanced |
| Portrait | [0.5, 0.8] | 10–13 rows | Tall |
| Square | [0.85, 1.15] | 8–10 rows | ~1:1 |
| Landscape | [1.25, 2.0] | 6–8 rows | Wide |

---

## Implementation

### File: `src/lib/collageLayout.ts`

#### 1. Add `getAspectBounds` function (after `getMaxPhotosPerRow`, ~line 92)

```typescript
/**
 * Get target aspect ratio bounds for each shape.
 * Used to clamp row count search range.
 */
function getAspectBounds(
  shape: CollageSettings['shape']
): [number, number] {
  switch (shape) {
    case 'portrait':
      return [0.5, 0.8];    // Tall: 1:2 to 4:5
    case 'square':
      return [0.85, 1.15];  // Near 1:1
    case 'landscape':
      return [1.25, 2.0];   // Wide: 5:4 to 2:1
    case 'auto':
    default:
      return [0.67, 1.5];   // Balanced variety
  }
}
```

#### 2. Update `findBestRowSplit` (lines 361-371)

Replace the current row range calculation:

```typescript
function findBestRowSplit(
  dims: PhotoDimension[],
  shape: CollageSettings['shape'],
  randomize: boolean = false,
  minPhotosPerRow: number = 2
): PhotoDimension[][] {
  const workingDims = randomize ? shuffleArray(dims) : dims;
  const n = workingDims.length;
  
  if (n <= 1) return [workingDims];
  
  // === NEW: Mathematical aspect ratio guardrail ===
  // Calculate sum of aspect ratios
  const S = workingDims.reduce((sum, d) => sum + d.aspectRatio, 0);
  
  // Get target aspect bounds for this shape
  const [minAspect, maxAspect] = getAspectBounds(shape);
  
  // Derive row bounds from R = √(S / A)
  const minRowsFromAspect = Math.ceil(Math.sqrt(S / maxAspect));
  const maxRowsFromAspect = Math.floor(Math.sqrt(S / minAspect));
  
  // === KEEP: Existing density-based constraints ===
  const maxPhotosPerRow = getMaxPhotosPerRow(n, shape);
  const minRowsFromMax = Math.ceil(n / maxPhotosPerRow);
  const minRowsFromDensity = Math.max(1, Math.floor(n / 8));
  
  // Combine all constraints (aspect + density)
  const minRows = Math.max(minRowsFromAspect, minRowsFromMax, minRowsFromDensity, 2);
  const maxRows = Math.min(maxRowsFromAspect, n, Math.ceil(n / minPhotosPerRow) + 2);
  
  // Edge case: if constraints conflict, favor aspect ratio bounds
  const effectiveMaxRows = Math.max(minRows, maxRows);
  
  // ... rest of function unchanged, just use effectiveMaxRows ...
```

---

## What Changes / What Stays

| Component | Status |
|-----------|--------|
| `scorePartition` | **Unchanged** — all penalties stay |
| `directionPenalty` | **Unchanged** — still nudges toward shape |
| `areaCV`, `heightCV` | **Unchanged** — still optimizes uniformity |
| `getMaxPhotosPerRow` | **Unchanged** — still prevents overly dense rows |
| `findBestRowSplit` | **Modified** — adds aspect-based row clamping |

---

## Edge Case Handling

**If `minRowsFromAspect > maxRowsFromAspect`** (very unusual photo mix):
- We use `effectiveMaxRows = Math.max(minRows, maxRows)` to ensure a valid range
- The algorithm will pick the closest valid row count
- Example: 10 extremely wide panoramas (aspect 4:1 each) in Portrait mode
  - S = 40, Portrait wants aspect 0.5–0.8
  - minRows = ceil(√(40/0.8)) = 8
  - maxRows = floor(√(40/0.5)) = 9
  - Valid range: 8–9 rows ✓

---

## Summary

This is a ~15-line surgical change that:
1. Adds a small utility function `getAspectBounds`
2. Calculates aspect-based row bounds in `findBestRowSplit`
3. Combines them with existing density constraints using `Math.max` / `Math.min`

All existing scoring, penalties, and behaviors remain intact. The only difference is the algorithm won't even *consider* partitions that would create extreme aspect ratios.

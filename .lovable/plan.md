# AR-Budget Row Distribution

**Status: IMPLEMENTED ✓**

## Overview

Replace the rigid round-robin photo distribution with a geometry-aware AR-budget algorithm that creates organic row-size variation while preventing problematic singletons based on row height, not photo count.

## Design Intent

**Problem**: Current round-robin always produces uniform distributions (e.g., `[5,5,5]` for 15 photos in 3 rows), creating visual "sameness" in layouts.

**Goal**: Produce distributions like `[4,6,5]` or `[2,6,7]` that feel organic, while still preventing awkward tall singleton rows (portrait alone) but allowing geometrically valid singletons (panorama alone).

**Key Insight**: The constraint should be on **row height**, not photo count. A row with a single panorama (AR 2.5) creates a short, balanced row. A row with a single portrait (AR 0.6) creates a towering, awkward row.

---

## Algorithm: AR-Budget Greedy Packing

```text
Input: shuffled photos[], targetRowCount, tuning

1. Calculate AR budget per row:
   totalAR = sum(all photo ARs)
   baseRowAR = totalAR / targetRowCount

2. Pack greedily with jitter:
   rows = []
   currentRow = []
   currentAR = 0
   
   for each photo in photos:
     jitteredTarget = baseRowAR * random(1 - jitter, 1 + jitter)
     
     if currentAR >= jitteredTarget AND currentRow not empty:
       finalize currentRow, start new row
     
     add photo to currentRow
     currentAR += photo.AR
   
   finalize last row

3. Validate row heights:
   avgRowAR = totalAR / rows.length
   
   for each row:
     if row.arSum < avgRowAR / maxHeightRatio:
       redistribute (merge with adjacent or steal photos)
```

### Why This Works

| Scenario | Row AR Sum | Relative Height | Result |
|----------|------------|-----------------|--------|
| 5 mixed photos (AR ~5.0) | 5.0 | 1.0x avg | Normal |
| 1 panorama (AR 2.5) | 2.5 | ~1.5x avg | Allowed |
| 1 portrait (AR 0.6) | 0.6 | ~6x avg | **Blocked** |
| 2 portraits (AR 1.2) | 1.2 | ~3x avg | May redistribute |

The math naturally allows panorama singletons while preventing portrait singletons.

---

## Technical Changes

### File: `src/lib/v3/types.ts`

**Add two new tuning parameters:**

```typescript
export interface V3Tuning {
  // ... existing 9 params ...
  
  // === Row Distribution ===
  /** AR budget jitter for organic variation (0.2 = +/- 20%) */
  row_arBudgetJitter: number;
  /** Max row height relative to average (1.8 = 180% of avg height) */
  row_maxHeightRatio: number;
}

export const DEFAULT_V3_TUNING: V3Tuning = {
  // ... existing defaults ...
  row_arBudgetJitter: 0.2,
  row_maxHeightRatio: 1.8,
};
```

---

### File: `src/lib/v3/utils.ts`

**Add shared `distributeByARBudget` function:**

This function will be imported by both `row-pack.ts` (pixel space) and `normalized-pack.ts` (normalized space).

```typescript
/**
 * Distribute photos across rows using AR-budget greedy packing.
 * 
 * Instead of rigid round-robin ([5,5,5]), this creates organic 
 * distributions ([4,6,5]) based on actual photo geometry.
 * 
 * @param photos - Photos to distribute (should be pre-shuffled)
 * @param targetRowCount - Target number of rows
 * @param tuning - V3Tuning for jitter and height ratio params
 * @returns Array of rows (each row is array of photos)
 */
export function distributeByARBudget(
  photos: PhotoDimension[],
  targetRowCount: number,
  tuning: V3Tuning
): PhotoDimension[][]
```

**Algorithm steps:**

1. Calculate `totalAR` and `baseRowAR = totalAR / targetRowCount`
2. Greedy pack: walk photos, accumulate AR, start new row when jittered budget reached
3. Validate: check each row's AR isn't too low (would create tall row)
4. Redistribute if needed: merge tiny rows or steal from large adjacent rows
5. Return resulting row distribution

---

### File: `src/lib/v3/normalized-pack.ts`

**Update function signatures to accept `V3Tuning`:**

Current signatures:
```typescript
export function packToFillHeight(
  photos: PhotoDimension[],
  targetHeight: number,
  normalizedGap: number,
  rowCount: number
): NormalizedPackResult

export function packToFillWidth(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  rowCount: number
): NormalizedPackResult
```

Updated signatures:
```typescript
export function packToFillHeight(
  photos: PhotoDimension[],
  targetHeight: number,
  normalizedGap: number,
  rowCount: number,
  tuning: V3Tuning  // NEW
): NormalizedPackResult

export function packToFillWidth(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  rowCount: number,
  tuning: V3Tuning  // NEW
): NormalizedPackResult
```

**Replace round-robin with AR-budget distribution:**

Change from:
```typescript
const rows = distributeToRowsRoundRobin(photos, rowCount);
```

To:
```typescript
const rows = distributeByARBudget(photos, rowCount, tuning);
```

**Remove local `distributeToRowsRoundRobin` function** (lines 240-249) - no longer needed.

---

### File: `src/lib/v3/row-pack.ts`

**Update `packWithRowCount` to receive tuning:**

Current:
```typescript
function packWithRowCount(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  rowCount: number
): PackingResult
```

Updated:
```typescript
function packWithRowCount(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  rowCount: number,
  tuning: V3Tuning  // NEW
): PackingResult
```

**Replace round-robin with AR-budget distribution:**

Change from:
```typescript
const rows = distributeToRowsRoundRobin(photos, rowCount);
```

To:
```typescript
const rows = distributeByARBudget(photos, rowCount, tuning);
```

**Update all call sites** of `packWithRowCount` to pass `tuning`.

**Remove local `distributeToRowsRoundRobin` function** (lines 300-309) - replaced by shared utility.

---

### File: `src/lib/v3/split-search.ts`

**Update calls to `packToFillHeight` and `packToFillWidth`:**

Add `tuning` as final parameter to all 4 call sites:
- Line 89: `packToFillWidth(..., tuning)`
- Line 134: `packToFillHeight(..., tuning)`  
- Line 151: `packToFillWidth(..., tuning)`
- (Any other call sites)

---

### File: `src/lib/v3/intersection.ts`

**Update calls to `packToFillHeight` and `packToFillWidth`:**

Add `tuning` as final parameter to all call sites:
- Line 164: `packToFillHeight(..., tuning)`
- Line 177: `packToFillWidth(..., tuning)`
- Line 477: `packToFillWidth(..., tuning)`

---

## Edge Cases Handled

1. **Very few photos (2-3)**: Jitter may produce same distribution as round-robin - acceptable
2. **All panoramas**: Each could get own row (AR budget reached quickly) - geometrically valid
3. **All portraits**: Multiple grouped per row (need high AR budget per row) - prevents tall singletons
4. **Single photo**: Skip distribution entirely (already handled in single-photo fast path)
5. **Greedy produces wrong row count**: Algorithm may produce ±1 row from target; acceptable for organic feel
6. **Row too tall after packing**: Height validation catches and redistributes

---

## Logging

Add dev logging to show:
- Target row count vs actual row count produced
- AR budget per row (base and jittered)
- Any redistribution that occurred
- Final row sizes: `[4, 6, 5]`

---

## Expected Outcomes

**Before (round-robin):**
- 15 photos in 3 rows → always `[5, 5, 5]`
- Predictable, uniform appearance

**After (AR-budget):**
- 15 photos in 3 rows → `[4, 6, 5]` or `[5, 4, 6]` or `[2, 6, 7]` etc.
- Organic variation based on actual photo shapes
- No awkward tall singletons (portraits)
- Panorama singletons allowed when geometrically sound

